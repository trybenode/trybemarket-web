import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, senderName, productName, chatLink } = req.body;

  if (!email || !senderName || !productName  || !chatLink) {
    return res.status(400).json({ error: "Missing required fields" });
  }

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

  try {
    await transporter.sendMail({
      from: `"Trybe Market" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📩 New message about ${productName}`,
      template: "newMessage",
      context: {
        senderName,
        productName,
        chatLink,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email sending failed:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
