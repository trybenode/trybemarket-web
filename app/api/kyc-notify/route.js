// app/api/kyc-notify/route.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const body = await req.json();
  const { userId, fullName, matricNumber } = body;

  try {
    await resend.emails.send({
      from: "Trybe Market <onboarding@resend.dev>",
      to: ["trybenode@gmail.com"], // or multiple: ['a@example.com', 'b@example.com']
      subject: "New KYC Request Submitted",
      html: `
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Full Name:</strong> ${fullName}</p>
        <p><strong>Matric Number:</strong> ${matricNumber}</p>
        <p>Check the dashboard for more details.</p>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Email sending error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
