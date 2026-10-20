// app/api/kyc-submit/route.js
export const runtime = "nodejs";
// Downloads up to three photos and runs OCR on them; the internal deadlines
// below keep it well inside this, so a slow check ends as "needs review",
// never as a function killed mid-way.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { isFullyVerified, toMillis } from "@/lib/kycAccess";
import {
  FRESHER_DOCUMENTS,
  KYC_TRACKS,
  KycError,
  claimKeyFor,
  claimKycSubmission,
  evaluateIdText,
  finalizeKyc,
  findClaimConflict,
  isPlausibleMatric,
  markKycForReview,
  nameWords,
  rejectKycAutomatically,
} from "@/lib/kycServer";
import {
  LIBRARY_CARD_PATTERN,
  TEMP_MATRIC_PATTERN,
  countNameMatches,
  deriveEligibility,
  evaluatePortal,
  parseLibraryCard,
  parsePortalText,
} from "@/lib/kycFresher";
import { readKycPhoto, verifyKycPhoto } from "@/lib/kycPhotos";
import { checkLiveness } from "@/lib/kycLiveness";
import { getKycConfig } from "@/lib/kycConfig";
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
const OUTDATED_PAGE = "This page is out of date — please refresh it and try again.";
const BAD_PHOTOS = "Your photos didn't upload properly — pick them again and resubmit.";

/**
 * POST /api/kyc-submit
 *
 *   ID card (also how a provisional student upgrades to full):
 *     { track: "id_card", fullName, matricNumber, photos: { front, back } }
 *   Fresher (100/200 level, no ID card yet):
 *     { track: "fresher_document", documentType: "portal_screenshot",
 *       fullName, tempMatric, photos: { front, selfie }, selfieSource }
 *     { track: "fresher_document", documentType: "library_card",
 *       fullName, libraryCardNumber, photos: { front, back, selfie }, selfieSource }
 *   Each photo is { publicId, version, signature } as Cloudinary returned it.
 *
 * The whole submission, server-side. The browser only uploads the photos
 * (privately, to its own kyc/<uid>/ folder, signed by
 * /api/kyc/upload-signature) and calls this once. This route:
 *   1. validates the input and that every photo is the caller's own upload,
 *      in the right slot, and distinct (lib/kycPhotos.js verifyKycPhoto);
 *   2. claims the request (lib/kycServer.js claimKycSubmission) — refusing if
 *      already verified, still being checked, or past the daily limit, and
 *      archiving the previous request;
 *   3. reads the stored photos — the same images an admin sees;
 *   4. decides, or hands it to an admin (team emailed):
 *      - ID card: verified on a match (credit, badge, matric claim, CRSA
 *        count — finalizeKyc), otherwise review. A provisional student's
 *        upgrade also needs the name to match their provisional record.
 *      - Fresher: provisional only for a portal screenshot that passes every
 *        check, and only once auto-pass is switched on (config/kyc); library
 *        cards always go to review. Never auto-rejected, except when clearly
 *        not eligible (300 level or above, or not an LCU account).
 *      A number another account already holds always goes to review.
 */
export async function POST(req) {
  // Identity comes from the verified ID token, never the request body —
  // this route sets isVerified/kycLevel, awards credit, and (CRSA program)
  // counts toward a referrer's leaderboard, so it can't act on a client-claimed uid.
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
    return NextResponse.json({ error: OUTDATED_PAGE }, { status: 400 });
  }

  const submission = validate(body, userId);
  if (submission.error) {
    return NextResponse.json({ error: submission.error }, { status: 400 });
  }

  let attemptId;
  let upgrade = false;
  let provisionalName = null;
  let university = "";
  try {
    const userSnap = await adminDB.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (isFullyVerified(userSnap.data())) {
      return NextResponse.json({ error: "Your KYC is already verified." }, { status: 409 });
    }
    university = userSnap.data().selectedUniversity || "";
    ({ attemptId, upgrade, provisionalName } = await claimKycSubmission(userId, submission));
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
    if (submission.track === KYC_TRACKS.ID_CARD) {
      return await decideIdCard(userId, attemptId, submission, { university, upgrade, provisionalName });
    }
    return await decideFresher(userId, attemptId, submission, { university });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    await sendForReview(userId, attemptId, {
      state: "error",
      message: String(error?.message || error).slice(0, 200),
    }).catch((reviewError) => console.error("KYC: couldn't hand the request to review:", reviewError));
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  }
}

/** Checks the body; returns the submission to store, or { error }. */
function validate(body, userId) {
  const track = body.track === KYC_TRACKS.FRESHER ? KYC_TRACKS.FRESHER : KYC_TRACKS.ID_CARD;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  if (!fullName || fullName.length > 100 || nameWords(fullName).length < 2) {
    return { error: "Enter your full name as it appears on your document — at least two names." };
  }

  // Each photo must be the caller's own private upload, in its own slot, and
  // distinct — one image can't stand in for another.
  const photo = (slot) => verifyKycPhoto(body.photos?.[slot], userId, slot);
  const distinct = (photos) => new Set(photos.map((p) => p.publicId)).size === photos.length;

  if (track === KYC_TRACKS.ID_CARD) {
    const matricNumber = typeof body.matricNumber === "string" ? body.matricNumber.trim() : "";
    if (matricNumber.length > 60 || !isPlausibleMatric(matricNumber)) {
      return { error: "That doesn't look like a matric number — check it and try again." };
    }
    const front = photo("front");
    const back = photo("back");
    if (!front || !back || !distinct([front, back])) return { error: BAD_PHOTOS };
    return { track, documentType: "student_id", fullName, matricNumber, photos: { front, back } };
  }

  const documentType = body.documentType;
  const selfieSource = body.selfieSource === "file" ? "file" : "live";
  const selfie = photo("selfie");
  if (documentType === FRESHER_DOCUMENTS.PORTAL) {
    const tempMatric = String(body.tempMatric ?? "").replace(/\s+/g, "");
    if (!TEMP_MATRIC_PATTERN.test(tempMatric)) {
      return { error: "Enter your 7-digit matriculation number exactly as it shows on your portal." };
    }
    const front = photo("front");
    if (!front || !selfie || !distinct([front, selfie])) return { error: BAD_PHOTOS };
    return { track, documentType, fullName, tempMatric, photos: { front, selfie }, selfieSource };
  }
  if (documentType === FRESHER_DOCUMENTS.LIBRARY) {
    const libraryCardNumber = String(body.libraryCardNumber ?? "").replace(/\s+/g, "");
    if (!LIBRARY_CARD_PATTERN.test(libraryCardNumber)) {
      return { error: "Enter the Card No from the front of your library card (digits only)." };
    }
    const front = photo("front");
    const back = photo("back");
    if (!front || !back || !selfie || !distinct([front, back, selfie])) return { error: BAD_PHOTOS };
    return { track, documentType, fullName, libraryCardNumber, photos: { front, back, selfie }, selfieSource };
  }
  return { error: OUTDATED_PAGE };
}

async function decideIdCard(userId, attemptId, submission, { university, upgrade, provisionalName }) {
  const { fullName, matricNumber, photos } = submission;
  let autoCheck;
  try {
    const text = await withDeadline(readPhotosText([photos.front, photos.back], "text"), CHECK_DEADLINE_MS);
    const result = evaluateIdText(text.join("\n"), { fullName, matricNumber, university });
    autoCheck = {
      state: result.pass ? "passed" : "needs_review",
      nameMatched: result.nameMatched,
      nameWords: result.nameWords,
      matricFound: result.matricFound,
      institutionFound: result.institutionFound,
    };
    // Upgrading from provisional: the ID must be for the same student.
    if (upgrade && provisionalName && countNameMatches(fullName, provisionalName) < 2) {
      autoCheck = { ...autoCheck, state: "needs_review", upgradeNameMismatch: true };
    }
  } catch (checkError) {
    console.error("KYC automatic check failed to run:", checkError);
    autoCheck = { state: "error", message: String(checkError?.message || checkError).slice(0, 200) };
  }

  if (autoCheck.state !== "passed") {
    await sendForReview(userId, attemptId, autoCheck);
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  }

  const result = await finalizeKyc(userId, {
    level: "full",
    matricNumber,
    claimKey: claimKeyFor(submission),
    autoCheck: { ...autoCheck, attemptId },
  });
  if (result.superseded) {
    // An admin decided, or the student resubmitted, while this ran.
    return NextResponse.json({ success: true, status: result.status, superseded: true });
  }
  const emailSent = await emailResult(userId, fullName, result.status, {
    reason: result.rejectionReason === "matric_already_used" ? MATRIC_CONFLICT_MESSAGE : null,
  });
  return NextResponse.json({
    success: true,
    status: result.status,
    rejectionReason: result.rejectionReason,
    emailSent,
  });
}

async function decideFresher(userId, attemptId, submission, { university }) {
  const { documentType, fullName, tempMatric, photos, selfieSource } = submission;
  const config = await getKycConfig();
  const liveness = await checkLiveness({ selfie: photos.selfie, selfieSource });

  // LCU only, for now (all recent signups are LCU). An admin can still approve.
  if (!/lead\s*city/i.test(university)) {
    await rejectKycAutomatically(userId, attemptId, {
      rejectionReason: "not_eligible",
      autoCheck: { state: "not_eligible", reason: "not_lcu" },
      extra: { liveness, eligibility: { eligible: false, reason: "not_lcu" } },
    });
    return NextResponse.json({ success: true, status: "rejected", rejectionReason: "not_eligible" });
  }

  let ocrSummary;
  let eligibility;
  let autoPass = false;
  let checks = null;
  try {
    if (documentType === FRESHER_DOCUMENTS.PORTAL) {
      const [text] = await withDeadline(readPhotosText([photos.front], "document"), CHECK_DEADLINE_MS);
      const parsed = parsePortalText(text);
      const evaluation = evaluatePortal(parsed, { fullName, tempMatric }, config);
      checks = evaluation.checks;
      eligibility = evaluation.eligibility;
      ocrSummary = { portal: parsed, checks };
      autoPass = evaluation.pass;
    } else {
      const [frontText, backText] = await withDeadline(
        readPhotosText([photos.front, photos.back], "document"),
        CHECK_DEADLINE_MS
      );
      const parsed = parseLibraryCard(frontText, backText);
      eligibility = deriveEligibility({ source: "library", yearOfEntry: parsed.yearOfEntry }, config);
      ocrSummary = { library: parsed };
    }
  } catch (checkError) {
    console.error("KYC fresher check failed to run:", checkError);
    await sendForReview(
      userId,
      attemptId,
      { state: "error", message: String(checkError?.message || checkError).slice(0, 200) },
      { liveness }
    );
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  }
  const extra = { liveness, ocrSummary, eligibility };

  // The only automatic "not eligible": a portal screenshot that clearly says
  // 300 level or above. (The library card's year is a hint for the admin.)
  if (documentType === FRESHER_DOCUMENTS.PORTAL && eligibility.eligible === false) {
    await rejectKycAutomatically(userId, attemptId, {
      rejectionReason: "not_eligible",
      autoCheck: { state: "not_eligible", reason: "level", level: eligibility.derivedLevel },
      extra,
    });
    return NextResponse.json({ success: true, status: "rejected", rejectionReason: "not_eligible" });
  }

  // A number another account already holds: an admin decides (they can
  // release the claim or take it over) — never an automatic rejection.
  const claimKey = claimKeyFor(submission);
  const claimConflict = await findClaimConflict(claimKey, userId);
  if (claimConflict) {
    await sendForReview(userId, attemptId, { state: "needs_review", claimConflict: true, checks }, {
      ...extra,
      claimConflict: { claimKey, ...claimConflict },
    });
    return NextResponse.json({ success: true, status: "pending", review: "manual" });
  }

  const inReviewSample = autoPass && config.portalAutopass && (await takeAutopassReviewSample(config));
  if (autoPass && config.portalAutopass && !inReviewSample) {
    const result = await finalizeKyc(userId, {
      level: "provisional",
      claimKey,
      autoCheck: { state: "passed", attemptId, checks },
      extra,
    });
    if (result.superseded) {
      return NextResponse.json({ success: true, status: result.status, superseded: true });
    }
    const emailSent = await emailResult(userId, fullName, result.status);
    return NextResponse.json({ success: true, status: result.status, emailSent });
  }

  // Launch mode (auto-pass off), a library card, the first-N sample, or a
  // check that didn't fully pass: an admin decides.
  // passed_launch_review: passed every check, but auto-pass is off (launch mode).
  // passed_review_sample: passed, auto-pass is on, but it's in the first-N sample.
  const state = !autoPass ? "needs_review" : inReviewSample ? "passed_review_sample" : "passed_launch_review";
  await sendForReview(userId, attemptId, { state, checks }, extra);
  return NextResponse.json({ success: true, status: "pending", review: "manual" });
}

/**
 * While auto-pass is on, the first `portalAutopassReviewFirst` passing portal
 * screenshots still go to an admin, so OCR accuracy is confirmed against real
 * decisions. Returns true if this one is part of that sample.
 */
async function takeAutopassReviewSample(config) {
  const ref = adminDB.collection("config").doc("kycCounters");
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const reviewed = snap.exists ? snap.data().portalAutopassReviewed || 0 : 0;
    if (reviewed >= config.portalAutopassReviewFirst) return false;
    tx.set(ref, { portalAutopassReviewed: reviewed + 1 }, { merge: true });
    return true;
  });
}

/** The result email to the account's OWN email. A decision is already committed, so failures are logged only. */
async function emailResult(userId, fullName, status, { reason = null } = {}) {
  try {
    const email = await resolveKycRecipient(userId);
    if (!email) return false;
    let expiresAt = null;
    if (status === "provisional") {
      const user = await adminDB.collection("users").doc(userId).get();
      expiresAt = toMillis(user.data()?.provisionalExpiresAt);
    }
    await sendKycEmail({ email, fullName, status, reason, expiresAt });
    return true;
  } catch (emailError) {
    console.error("Error sending KYC email:", emailError);
    return false;
  }
}

/** Records why the check didn't decide (plus details for the admin), then tells the team (best-effort). */
async function sendForReview(userId, attemptId, autoCheck, extra = {}) {
  const recorded = await markKycForReview(userId, attemptId, autoCheck, extra);
  if (!recorded) return;
  try {
    await notifyTeamOfKycReview(userId, describeForTeam(autoCheck, extra));
  } catch (notifyError) {
    console.error("Error notifying the team of a KYC request:", notifyError);
  }
}

function describeForTeam(autoCheck, extra) {
  if (autoCheck.state === "error") {
    return `The automatic check couldn't run (${autoCheck.message || "unknown error"}).`;
  }
  const parts = [];
  if (extra.claimConflict) parts.push(`number ${extra.claimConflict.claimKey} is held by another account`);
  if (extra.ocrSummary?.portal) {
    const c = extra.ocrSummary.portal;
    parts.push(
      `Fresher portal screenshot · level ${c.level ?? "?"} · session ${c.session ?? "?"} · number ${
        autoCheck.checks?.numberMatches ? "matches" : "doesn't match"
      }${
        autoCheck.state === "passed_review_sample"
          ? " · passed every check (auto-pass review sample)"
          : autoCheck.state === "passed_launch_review"
            ? " · passed every check (auto-pass is off)"
            : ""
      }`
    );
  } else if (extra.ocrSummary?.library) {
    const l = extra.ocrSummary.library;
    parts.push(
      `Fresher library card · markers front ${l.frontMarkers.leadCity && l.frontMarkers.librarian ? "found" : "missing"}, back ${
        l.backMarkers.property ? "found" : "missing"
      } · year of entry ${l.yearOfEntry ?? "unreadable"}`
    );
  } else {
    parts.push(
      `Name ${autoCheck.nameMatched}/${autoCheck.nameWords} words`,
      autoCheck.matricFound ? "matric found" : "matric not found",
      autoCheck.institutionFound ? "school found" : "school not found"
    );
    if (autoCheck.upgradeNameMismatch) parts.push("name doesn't match the provisional record");
  }
  if (extra.liveness?.selfieSource === "file") parts.push("selfie from a file, not the live camera");
  return parts.join(" · ");
}

/**
 * OCR text of each photo, in order, read from the stored private copies.
 * "text" is Vision text detection (ID cards, as before); "document" is
 * document text detection, better for dense screens and handwriting.
 */
async function readPhotosText(photos, mode) {
  const read = await Promise.all(photos.map((p) => readKycPhoto(p, { timeoutMs: PHOTO_FETCH_TIMEOUT_MS })));
  return Promise.all(read.map(({ bytes }) => ocr(bytes, mode)));
}

async function ocr(content, mode) {
  if (mode === "document") {
    const [result] = await client.documentTextDetection({ image: { content } }, { timeout: OCR_TIMEOUT_MS });
    if (result.error?.message) throw new Error(`OCR: ${result.error.message}`);
    return result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";
  }
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
