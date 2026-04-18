import { Resend } from "resend";
import { newMessageTemplate } from "../../emails/newMessageTemplate";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // console.log("Message notification API called");
  // console.log("Request body:", req.body);
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, senderName, productName, chatLink } = req.body;

  if (!email || !senderName || !productName || !chatLink) {
    console.log("Missing required fields:", { email, senderName, productName, chatLink });
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    console.log("Attempting to send email to:", email);
    
    const result = await resend.emails.send({
      from: "Trybe Market <contact@trybemarket.online>",
      to: email,
      subject: `📩 New message about ${productName}`,
      html: newMessageTemplate({ senderName, productName, chatLink }),
    });

    console.log("Email sent successfully:", result);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Email sending failed:", error);
    return res.status(500).json({ error: "Failed to send email", details: error.message });
  }
}
