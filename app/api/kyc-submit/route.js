export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { writeFileSync, existsSync } from "fs";
import path from "path";
import vision from "@google-cloud/vision";
import { adminDB } from "../../../lib/firebaseAdmin";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

async function getVisionClient() {
  const keyPath = path.join("/tmp", "markettrybe-key.json");

  if (!existsSync(keyPath)) {
    const keyBase64 = process.env.GOOGLE_CLOUD_KEY_BASE64;
    if (!keyBase64) throw new Error("Missing GOOGLE_CLOUD_KEY_BASE64");

    const keyJson = Buffer.from(keyBase64, "base64").toString("utf-8");
    writeFileSync(keyPath, keyJson);
  }

  return new vision.ImageAnnotatorClient({ keyFilename: keyPath });
}

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

    // Get Vision client at runtime
    const client = await getVisionClient();

    // OCR only the front image
    const [frontResult] = await client.textDetection({
      image: { content: frontID },
    });

    const frontText = frontResult.textAnnotations?.[0]?.description || "";
    const combinedText = frontText.toLowerCase();
    const normalizedText = normalize(combinedText);

    const nameParts = fullName.toLowerCase().split(" ").filter(Boolean);

    let nameMatchCount = 0;
    nameParts.forEach((word) => {
      if (normalizedText.includes(word.toLowerCase())) {
        nameMatchCount++;
      }
    });

    const nameMatch = nameMatchCount >= 2;
    const matricMatch = normalizedText.includes(normalize(matricNumber));
    const status = nameMatch && matricMatch ? "verified" : "rejected";

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
