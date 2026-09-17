// app/api/kyc-submit/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import admin from "firebase-admin";
import { adminDB } from "../../../lib/firebaseAdmin";
import { Resend } from "resend";
import { kycSuccessTemplate, kycRejectedTemplate } from "@/emails/kycEmailTemplates";
import { CREDIT_EVENT_TYPES } from "@/lib/creditConstants";
import { BADGE_KEYS } from "@/lib/badgeConstants";

const KYC_CREDIT_AMOUNT = 150;

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
    const body = await req.json();
    const {
      userId,
      fullName,
      matricNumber,
      frontID,
      backID,
      email: emailFromBody,
    } = body;
    if (!userId || !fullName || !matricNumber || !frontID || !backID) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const matricMatch = normalizedText.includes(normalize(matricNumber));
    // const nameMatch = normalizedText.includes(normalize(fullName));
    const status = nameMatch && matricMatch ? "verified" : "rejected";

    // Update Firestore KYC status, flip isVerified, award the one-time KYC
    // credit, and award the Verified Student badge — all in a single
    // transaction. This is the only place isVerified is ever set to true
    // (never client-side; see firestore.rules), and both awards are
    // idempotent by construction: each doc's fixed ID IS the "already
    // awarded" check, so re-submitting an already-verified user (or a
    // concurrent duplicate call) can't double-pay or double-award.
    const kycRef = adminDB.collection("kycRequests").doc(userId);
    const userRef = adminDB.collection("users").doc(userId);
    const ledgerRef = userRef.collection("creditLedger").doc("kyc_verification_complete");
    const badgeRef = userRef.collection("badges").doc(BADGE_KEYS.VERIFIED_STUDENT);

    await adminDB.runTransaction(async (tx) => {
      // All reads must precede all writes in a Firestore transaction.
      const ledgerSnap = status === "verified" ? await tx.get(ledgerRef) : null;
      const badgeSnap = status === "verified" ? await tx.get(badgeRef) : null;

      tx.update(kycRef, {
        status,
        reviewedAt: new Date(),
        notificationSent: true,
      });

      if (status === "verified") {
        const userUpdate = { isVerified: true };
        if (!ledgerSnap.exists) {
          tx.set(ledgerRef, {
            amount: KYC_CREDIT_AMOUNT,
            type: CREDIT_EVENT_TYPES.KYC_VERIFICATION_COMPLETE,
            referenceId: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          userUpdate.creditBalance = admin.firestore.FieldValue.increment(KYC_CREDIT_AMOUNT);
        }
        if (!badgeSnap.exists) {
          tx.set(badgeRef, {
            badgeKey: BADGE_KEYS.VERIFIED_STUDENT,
            awardedAt: admin.firestore.FieldValue.serverTimestamp(),
            periodKey: null,
          });
        }
        tx.set(userRef, userUpdate, { merge: true });
      }
    });

    // Send email
    await sendKycEmail({ email, fullName, status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    return NextResponse.json(
      { error: "KYC processing failed" },
      { status: 500 }
    );
  }
}
