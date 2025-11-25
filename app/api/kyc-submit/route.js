// app/api/kyc-submit/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "path";
import { adminDB } from "../../../lib/firebaseAdmin";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

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

// Helper to send KYC email
async function sendKycEmail({ email, fullName, status }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  transporter.use(
    "compile",
    hbs({
      viewEngine: {
        partialsDir: path.resolve("./emails/"),
        defaultLayout: false,
      },
      viewPath: path.resolve("./emails/"),
      extName: ".hbs",
    })
  );
  const templateName = status === "verified" ? "kycSuccess" : "kycRejected";
  await transporter.sendMail({
    from: `Trybe Market <${process.env.EMAIL_USER}>`,
    to: email,
    subject:
      status === "verified"
        ? "Your Trybe Market KYC Status Update"
        : "Your KYC Was Rejected",
    template: templateName,
    context: { name: fullName },
  });
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

    // Update Firestore KYC status
    await adminDB.collection("kycRequests").doc(userId).update({
      status,
      reviewedAt: new Date(),
      notificationSent: true,
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
