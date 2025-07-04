// app/api/kyc-submit/route.js
export const runtime = "nodejs";


import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "path";
import { adminDB } from "../../../lib/firebaseAdmin";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

// Send email with handlebars template
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

// Text normalization helper
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/gi, ""); // more compact
}

// ✅ API Handler
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

    if (
      !userId ||
      !fullName ||
      !matricNumber ||
      !frontID ||
      !backID ||
      !emailFromBody
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const email = emailFromBody;

    // ✅ Secure key parsing and Vision client creation
    const serviceAccount = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
    const client = new vision.ImageAnnotatorClient({
      credentials: serviceAccount,
    });

    // OCR
    const [frontResult] = await client.textDetection({
      image: { content: frontID },
    });
    const frontText = frontResult.textAnnotations?.[0]?.description || "";
    const normalizedText = normalize(frontText);

    // Name matching
    const nameParts = fullName.toLowerCase().split(" ").filter(Boolean);
    let nameMatchCount = 0;
    nameParts.forEach((word) => {
      if (normalizedText.includes(normalize(word))) nameMatchCount++;
    });

    const nameMatch = nameMatchCount >= 2;
    const matricMatch = normalizedText.includes(normalize(matricNumber));

    const status = nameMatch && matricMatch ? "verified" : "rejected";

    // ✅ Firestore Admin update
    await adminDB.collection("kycRequests").doc(userId).update({
      status,
      reviewedAt: new Date(),
      notificationSent: true,
    });

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
