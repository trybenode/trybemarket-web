import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, fullName, status } = req.body;

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

  try {
    await transporter.sendMail({
      from: `"Trybe Market" <${process.env.EMAIL_USER}>`,
      to: email,
      subject:
        status === "verified"
          ? "Your Trybe Market KYC Status Update"
          : "Your KYC Was Rejected",
      template: templateName,
      context: { name: fullName },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email sending failed:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
