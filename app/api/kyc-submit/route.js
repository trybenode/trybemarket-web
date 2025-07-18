export const runtime = "nodejs";

import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "path";
import { adminDB } from "../../../lib/firebaseAdmin";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import axios from "axios"; // ✅ Add this

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

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      userId,
      fullName,
      matricNumber,
      frontIDUrl, // ✅ receiving URL instead of base64
      backIDUrl, // (optional for now)
      email: emailFromBody,
    } = body;

    if (
      !userId ||
      !fullName ||
      !matricNumber ||
      !frontIDUrl ||
      !emailFromBody
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const email = emailFromBody;

    // ✅ Auth key from Vercel env
    const serviceAccount = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\\\n/g, "\n")
        .replace(/\\n/g, "\n");
    }
    const client = new vision.ImageAnnotatorClient({ credentials: serviceAccount });

    // ✅ Download image from Cloudinary
    const response = await axios.get(frontIDUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(response.data, "binary");

    // ✅ OCR from image buffer
    const [frontResult] = await client.textDetection({
      image: { content: imageBuffer },
    });

    const frontText = frontResult.textAnnotations?.[0]?.description || "";
    const normalizedText = normalize(frontText);

    const nameParts = fullName.toLowerCase().split(" ").filter(Boolean);
    let nameMatchCount = 0;
    nameParts.forEach((word) => {
      if (normalizedText.includes(normalize(word))) nameMatchCount++;
    });

    const nameMatch = nameMatchCount >= 2;
    const matricMatch = normalizedText.includes(normalize(matricNumber));
    const status = nameMatch && matricMatch ? "verified" : "rejected";

    // ✅ Update Firestore
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
