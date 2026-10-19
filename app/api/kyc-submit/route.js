// app/api/kyc-submit/route.js
export const runtime = "nodejs";
// Downloads two photos and runs OCR on both; the internal deadlines below keep
// it well inside this, so a slow check ends as "needs review", never as a
// function killed mid-way.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { isKycCleared } from "@/lib/kycAccess";
import {
  KycError,
  claimKycSubmission,
  evaluateIdText,
  finalizeKyc,
  isPlausibleMatric,
  markKycForReview,
  nameWords,
} from "@/lib/kycServer";
import { readKycPhoto, verifyKycPhoto } from "@/lib/kycPhotos";
import { sendKycEmail, resolveKycRecipient } from "@/lib/kycEmail";
import { notifyTeamOfKycReview } from "@/lib/kycNotify";

// Use environment variable for service account credentials
let credentials;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  // Fix double-escaped newlines in private key
  creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  credentials = creds;
}

const client = credentials
  ? new vision.ImageAnnotatorClient({ credentials })
  : new vision.ImageAnnotatorClient(); // Falls back to default credentials

const PHOTO_FETCH_TIMEOUT_MS = 10_000;
const OCR_TIMEOUT_MS = 20_000;
const CHECK_DEADLINE_MS = 40_000;

const MATRIC_CONFLICT_MESSAGE = "This matric number is already linked to another verified account.";

/**
 * POST /api/kyc-submit  { fullName, matricNumber, photos: { front, back } }
 *   (each photo is { publicId, version, signature } as Cloudinary returned it)
 *
 * The whole KYC submission, server-side. The browser only uploads the two ID
 * photos (privately, to its own kyc/<uid>/ folder, with a signature from
 * /api/kyc/upload-signature) and calls this once. This route:
 *   1. validates the input and that both photos are the caller's own uploads,
 *      in the right slots (lib/kycPhotos.js verifyKycPhoto);
 *   2. claims the request (lib/kycServer.js claimKycSubmission) — refusing if
 *      already verified, still being checked, or past the daily limit;
 *   3. OCRs BOTH stored photos — the same images an admin sees;
 *   4. verifies on a match (finalizeKyc: isVerified, credit, badge, matric
 *      claim, CRSA count, all in one transaction), or otherwise leaves the
 *      request PENDING for an admin and emails the team. A genuine student is
 *      never auto-rejected; only a matric already used by another verified
 *      account is.
 *
 * It used to be the last of three client calls after the browser had already
 * saved a "pending" request — any failure in between left the student stuck
 * "under review" with nothing reviewing it — and it OCR'd base64 the browser
 * sent rather than the stored photo the admin reviews.
 */
export async function POST(req) {
  // Identity comes from the verified ID token, never the request body —
  // this route flips isVerified, awards credit, and (CRSA program) counts
  // toward a referrer's leaderboard, so it can't act on a client-claimed uid.
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.uid;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // A page loaded before this version sends base64 photos or public URLs.
  if (!body.photos && (body.frontUrl || body.frontID || body.backID)) {
    return NextResponse.json(
      { error: "This page is out of date — please refresh it and try again." },
      { status: 400 }
    );
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  const matricNumber = typeof body.matricNumber === "string" ? body.matricNumber.trim() : "";

  if (!fullName || fullName.length > 100 || nameWords(fullName).length < 2) {
    return NextResponse.json(
      { error: "Enter your full name as it appears on your ID — at least two names." },
      { status: 400 }
    );
  }
  if (matricNumber.length > 60 || !isPlausibleMatric(matricNumber)) {
    return NextResponse.json(
      { error: "That doesn't look like a matric number — check it and try again." },
      { status: 400 }
    );
  }
  // Each photo must be the caller's own private upload, in its own slot, and
  // distinct — one image can't stand in for both sides.
  const front = verifyKycPhoto(body.photos?.front, userId, "front");
  const back = verifyKycPhoto(body.photos?.back, userId, "back");
  if (!front || !back || front.publicId === back.publicId) {
    return NextResponse.json(
      { error: "Your photos didn't upload properly — pick them again and resubmit." },
      { status: 400 }
    );
  }

  let attemptId;
  let university = "";
  try {
    const userSnap = await adminDB.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (isKycCleared(userSnap.data())) {
      return NextResponse.json({ error: "Your KYC is already verified." }, { status: 409 });
    }
    university = userSnap.data().selectedUniversity || "";

    ({ attemptId } = await claimKycSubmission(userId, {
      fullName,
      matricNumber,
      photos: { front, back },
    }));
  } catch (error) {
    if (error instanceof KycError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("KYC Submit Error (claim):", error);
    return NextResponse.json({ error: "KYC processing failed" }, { status: 500 });
  }

  // From here a request exists, so every path must leave it decided or
  // waiting for an admin — never "running".
  try {
    let autoCheck;
    try {
      const text = await withDeadline(readIdText(front, back), CHECK_DEADLINE_MS);
      const result = evaluateIdText(text, { fullName, matricNumber, university });
      autoCheck = {
        state: result.pass ? "passed" : "needs_review",
        nameMatched: result.nameMatched,
        nameWords: result.nameWords,
        matricFound: result.matricFound,
        institutionFound: result.institutionFound,
      };
    } catch (checkError) {
      console.error("KYC automatic check failed to run:", checkError);
      autoCheck = { state: "error", message: String(checkError?.message || checkError).slice(0, 200) };
    }

    if (autoCheck.state === "passed") {
      const result = await finalizeKyc(userId, {
        ocrStatus: "verified",
        matricNumber,
        autoCheck: { ...autoCheck, attemptId },
      });
      if (result.superseded) {
        // An admin decided, or the student resubmitted, while this ran.
        return NextResponse.json({ success: true, status: result.status, superseded: true });
      }

      // The recipient is the account's OWN email, resolved server-side. The
      // decision is already committed, so an email problem must not turn it
      // into an error.
      let emailSent = false;
      try {
        const email = await resolveKycRecipient(userId);
        if (email) {
          await sendKycEmail({
            email,
            fullName,
            status: result.status,
            reason: result.rejectionReason === "matric_already_used" ? MATRIC_CONFLICT_MESSAGE : null,
          });
          emailSent = true;
        }
      } catch (emailError) {
        console.error("Error sending KYC email:", emailError);
      }
      return NextResponse.json({
        success: true,
        status: result.status,
        rejectionReason: result.rejectionReason,
        emailSent,
      });
    }

    // Couldn't confirm it (or couldn't run): an admin decides.
    await sendForReview(userId, attemptId, autoCheck);
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    await sendForReview(userId, attemptId, {
      state: "error",
      message: String(error?.message || error).slice(0, 200),
    }).catch((reviewError) => console.error("KYC: couldn't hand the request to review:", reviewError));
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  }
}

/** Records why the check didn't decide, then tells the team (best-effort). */
async function sendForReview(userId, attemptId, autoCheck) {
  const recorded = await markKycForReview(userId, attemptId, autoCheck);
  if (!recorded) return;
  try {
    await notifyTeamOfKycReview(userId, describeAutoCheck(autoCheck));
  } catch (notifyError) {
    console.error("Error notifying the team of a KYC request:", notifyError);
  }
}

function describeAutoCheck(autoCheck) {
  if (autoCheck.state === "error") {
    return `The automatic check couldn't run (${autoCheck.message || "unknown error"}).`;
  }
  return [
    `Name ${autoCheck.nameMatched}/${autoCheck.nameWords} words`,
    autoCheck.matricFound ? "matric found" : "matric not found",
    autoCheck.institutionFound ? "school found" : "school not found",
  ].join(" · ");
}

/** OCR text of both ID photos, front then back — read from the stored private copies. */
async function readIdText(front, back) {
  const [frontPhoto, backPhoto] = await Promise.all([
    readKycPhoto(front, { timeoutMs: PHOTO_FETCH_TIMEOUT_MS }),
    readKycPhoto(back, { timeoutMs: PHOTO_FETCH_TIMEOUT_MS }),
  ]);
  const [frontText, backText] = await Promise.all([ocr(frontPhoto.bytes), ocr(backPhoto.bytes)]);
  return `${frontText}\n${backText}`;
}

async function ocr(content) {
  const [result] = await client.textDetection({ image: { content } }, { timeout: OCR_TIMEOUT_MS });
  if (result.error?.message) throw new Error(`OCR: ${result.error.message}`);
  return result.textAnnotations?.[0]?.description || "";
}

function withDeadline(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`The check took longer than ${ms / 1000}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
