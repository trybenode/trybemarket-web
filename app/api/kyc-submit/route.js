// app/api/kyc-submit/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { finalizeKyc, normalizeMatric, isValidNormalizedMatric } from "@/lib/kycServer";
import { sendKycEmail, resolveKycRecipient } from "@/lib/kycEmail";

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

function normalize(str) {
  return str.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
}

export async function POST(req) {
  try {
    // Identity comes from the verified ID token, never the request body —
    // this route flips isVerified, awards credit, and (CRSA program) counts
    // toward a referrer's leaderboard, so it can't act on a client-claimed uid.
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userId = auth.uid;

    const body = await req.json();
    const {
      userId: bodyUserId,
      fullName,
      matricNumber,
      frontID,
      backID,
    } = body;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json(
        { error: "You can only submit KYC for your own account" },
        { status: 403 }
      );
    }
    if (!fullName || !matricNumber || !frontID || !backID) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Reject before any OCR work: an empty normalized matric would make the
    // "includes" check below match anything.
    const normalizedMatric = normalizeMatric(matricNumber);
    if (!isValidNormalizedMatric(normalizedMatric)) {
      return NextResponse.json(
        { error: "Invalid matric number" },
        { status: 400 }
      );
    }

    // OCR only the front image
    const [frontResult] = await client.textDetection({
      image: { content: frontID },
    });
    const frontText = frontResult.textAnnotations?.[0]?.description || "";
    const combinedText = frontText.toLowerCase();
    const normalizedText = normalize(combinedText);

    const nameParts = fullName.toLowerCase().split(" ").filter(Boolean); // split name into words

    // Count how many name words are in the normalized text
    let nameMatchCount = 0;
    nameParts.forEach((word) => {
      if (normalizedText.includes(word.toLowerCase())) {
        nameMatchCount++;
      }
    });

    const nameMatch = nameMatchCount >= 2;

    // console.log("Front OCR Result:", frontResult);
    console.log("Normalized OCR Text:", normalizedText);

    const matricMatch = normalizedText.includes(normalizedMatric);
    const ocrStatus = nameMatch && matricMatch ? "verified" : "rejected";

    // Flips isVerified, awards the KYC credit + Verified Student badge, and
    // enforces one-matric-one-account, all in one transaction — see
    // lib/kycServer.js.
    const { status, rejectionReason } = await finalizeKyc(userId, { ocrStatus, matricNumber });

    // The recipient is the account's OWN email, resolved server-side — never a
    // body field, which would let any signed-in user aim this KYC-branded email
    // (with an attacker-chosen name) at any address. The verification above is
    // already committed, so an email problem must not turn it into an error.
    let emailSent = false;
    try {
      const email = await resolveKycRecipient(userId);
      if (email) {
        await sendKycEmail({ email, fullName, status });
        emailSent = true;
      }
    } catch (emailError) {
      console.error("Error sending KYC email:", emailError);
    }

    return NextResponse.json({ success: true, status, rejectionReason, emailSent });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    return NextResponse.json(
      { error: "KYC processing failed" },
      { status: 500 }
    );
  }
}
