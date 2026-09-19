// app/api/kyc-submit/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import { Resend } from "resend";
import { kycSuccessTemplate, kycRejectedTemplate } from "@/emails/kycEmailTemplates";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { finalizeKyc, normalizeMatric, isValidNormalizedMatric } from "@/lib/kycServer";

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Helper to send KYC email using Resend
async function sendKycEmail({ email, fullName, status }) {
  try {
    const isVerified = status === "verified";
    const htmlTemplate = isVerified
      ? kycSuccessTemplate({ name: fullName })
      : kycRejectedTemplate({ name: fullName });

    const result = await resend.emails.send({
      from: "Trybe Market <contact@trybemarket.online>",
      to: email,
      subject: isVerified
        ? "✅ Your Trybe Market KYC Status - Verified!"
        : "⚠️ Your Trybe Market KYC Status - Action Required",
      html: htmlTemplate,
    });

    console.log("KYC email sent via Resend:", result);
    return result;
  } catch (error) {
    console.error("Error sending KYC email via Resend:", error);
    throw error;
  }
}

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
      email: emailFromBody,
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

    const email = emailFromBody;
    if (!email) {
      return NextResponse.json(
        { error: "User email not found" },
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

    // Send email
    await sendKycEmail({ email, fullName, status });

    return NextResponse.json({ success: true, status, rejectionReason });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    return NextResponse.json(
      { error: "KYC processing failed" },
      { status: 500 }
    );
  }
}
