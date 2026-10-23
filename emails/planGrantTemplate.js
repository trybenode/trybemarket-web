import { SITE_URL } from "../lib/siteUrl.js";

/**
 * "You've got <plan> free" — sent when a promotion gives a student a plan
 * (lib/planGrantNotify.js). Same look as the newer KYC emails. Every
 * interpolated value must already be HTML-escaped.
 */
export function planGrantTemplate({ name, planName, durationText, endsOn, school, features, extended }) {
  const intro = extended
    ? `<p>Good news: as one of the first verified students${school ? ` at ${school}` : ""}, your <strong>${planName}</strong> plan has been extended by <strong>${durationText}</strong>, free. It now runs until <strong>${endsOn}</strong>.</p>`
    : `<p>Good news: as one of the first verified students${school ? ` at ${school}` : ""}, you've got <strong>${planName}</strong> free for <strong>${durationText}</strong>. It's active on your account now, until <strong>${endsOn}</strong>.</p>`;
  const list = features.length
    ? `<p style="margin-bottom: 6px;">What you get:</p><ul style="margin-top: 0; padding-left: 20px;">${features.map((f) => `<li style="margin-bottom: 4px;">${f}</li>`).join("")}</ul>`
    : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>You've got ${planName} free</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0;">
      <h1 style="color: #2563eb; font-size: 22px; margin: 0 0 20px;">You've got ${planName} free 🎉</h1>
      <p>Hi ${name},</p>
      ${intro}
      ${list}
      <p>You don't need to do anything: it's already switched on. List something now so buyers on your campus can find it.</p>
      <a href="${SITE_URL}/product-upload" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold;">List an item</a>
      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Best regards,<br />The TrybeMarket Team</p>
    </div>
  </body>
</html>
  `.trim();
}
