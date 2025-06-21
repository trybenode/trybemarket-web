// app/api/kyc-submit/route.js
import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "path";
import { adminDB } from "@/lib/firebaseAdmin"; // <-- new
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

const keyPath = path.join(process.cwd(), "markettrybe-cfed7-aeb679b5c606.json");
const client = new vision.ImageAnnotatorClient({ keyFilename: keyPath });

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

    // Use only the email from the request body (from userStore/localStorage)
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

    // Check for match (only in front image)
    const nameMatch = combinedText.includes(fullName.trim().toLowerCase());
    const matricMatch = combinedText.includes(
      matricNumber.trim().toLowerCase()
    );
    const status = nameMatch && matricMatch ? "verified" : "rejected";

    // Update Firestore KYC status
    await adminDB.collection("kycRequests").doc(userId).update({
      status,
      reviewedAt: new Date(),
      notificationSent: true,
    });

    // Send email
    await sendKycEmail({ email, fullName, status });

    // Respond immediately
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("KYC Submit Error:", error);
    return NextResponse.json(
      { error: "KYC processing failed" },
      { status: 500 }
    );
  }
}
