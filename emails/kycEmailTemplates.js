import { SITE_URL } from "../lib/siteUrl.js";

/**
 * KYC Email Templates for Resend
 */

export function kycSuccessTemplate({ name }) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>KYC Verification Successful</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f9f9f9;
        color: #333;
        padding: 20px;
      }
      .container {
        background-color: #fff;
        padding: 30px;
        border-radius: 8px;
        max-width: 600px;
        margin: auto;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      }
      .footer {
        margin-top: 30px;
        font-size: 14px;
        color: #555;
      }
      h1 {
        color: #2563eb;
        font-size: 24px;
        margin-bottom: 20px;
      }
      .success-icon {
        font-size: 48px;
        text-align: center;
        margin-bottom: 20px;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="success-icon">✅</div>
      <h1>KYC Verification Successful!</h1>
      
      <p>Hi ${name},</p>

      <p>Your KYC (Know Your Customer) verification has been successfully verified!</p>

      <p><strong>✅ Name:</strong> ${name}</p>

      <p>
        You now have full access to all features on TrybeMarket. Thank you for completing this important step to help keep our community secure and trusted.
      </p>

      <h4>Why KYC Matters:</h4>
      <ul>
        <li>Preventing fraud and identity theft</li>
        <li>Enabling secure transactions</li>
        <li>Building a safe and transparent ecosystem</li>
      </ul>

      <p>
        If you have any questions or notice any incorrect information, please contact our support team at
        <a href="mailto:contact@trybemarket.online">contact@trybemarket.online</a>.
      </p>

      <div class="footer">
        <p>Best regards,<br />The TrybeMarket Team</p>
        <p style="font-size: 12px; color: #888; margin-top: 20px;">
          © 2026 TrybeMarket. All rights reserved.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

/** `reason` must already be HTML-escaped (lib/kycEmail.js does it). */
export function kycRejectedTemplate({ name, reason = null }) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>KYC Verification Failed</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #fdf2f2;
        color: #5c1a1a;
        padding: 20px;
      }
      .container {
        background-color: #fffafa;
        padding: 30px;
        border-radius: 8px;
        max-width: 600px;
        margin: auto;
        border: 1px solid #f5c2c2;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      }
      .footer {
        margin-top: 30px;
        font-size: 14px;
        color: #7c2d2d;
      }
      h1 {
        color: #dc2626;
        font-size: 24px;
        margin-bottom: 20px;
      }
      .warning-icon {
        font-size: 48px;
        text-align: center;
        margin-bottom: 20px;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-bottom: 8px;
      }
      .retry-button {
        display: inline-block;
        background-color: #dc2626;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 20px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="warning-icon">⚠️</div>
      <h1>KYC Verification Could Not Be Completed</h1>
      
      <p>Hi ${name},</p>

      <p>We regret to inform you that your KYC (Know Your Customer) verification could not be completed at this time.</p>

      <p><strong>Name:</strong> ${name}</p>
${reason ? `
      <p><strong>Reason:</strong> ${reason}</p>
` : ""}
      <p>
        Please ensure that all submitted documents are clear, valid, and meet the required standards. You may log in to your account and resubmit your KYC request with the correct documents.
      </p>

      <h4>Tips for Successful KYC:</h4>
      <ul>
        <li>Upload clear, well-lit images of your documents</li>
        <li>Ensure names and details match your profile exactly</li>
        <li>Use accepted ID types only (Student ID card)</li>
        <li>Make sure all text is readable and not blurry</li>
        <li>Double-check your matriculation number matches</li>
      </ul>

      <p>
        If you believe this is an error or need assistance, please contact our support team at
        <a href="mailto:contact@trybemarket.online">contact@trybemarket.online</a>.
      </p>

      <a href="${SITE_URL}/kyc" class="retry-button">Retry KYC Verification</a>

      <div class="footer">
        <p>Best regards,<br />The TrybeMarket Team</p>
        <p style="font-size: 12px; color: #888; margin-top: 20px;">
          © 2026 TrybeMarket. All rights reserved.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

// Shared layout for the newer KYC emails. Every interpolated value must
// already be HTML-escaped (lib/kycEmail.js does it).
function simpleLayout({ title, heading, accent, body, buttonText, buttonHref }) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0;">
      <h1 style="color: ${accent}; font-size: 22px; margin: 0 0 20px;">${heading}</h1>
      ${body}
      <a href="${buttonHref}" style="display: inline-block; background-color: ${accent}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold;">${buttonText}</a>
      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Best regards,<br />The TrybeMarket Team</p>
    </div>
  </body>
</html>
  `.trim();
}

/** A fresher's provisional approval. `expiresOn` is a readable date, already escaped. */
export function kycProvisionalTemplate({ name, expiresOn }) {
  return simpleLayout({
    title: "You're provisionally verified",
    heading: "You're provisionally verified 🎓",
    accent: "#2563eb",
    body: `
      <p>Hi ${name},</p>
      <p>Your fresher documents have been approved. You can now list items and services and subscribe to a plan on TrybeMarket.</p>
      <p><strong>One thing left:</strong> once you get your student ID card, submit it to complete your verification. You have until <strong>${expiresOn}</strong>.</p>
      <p>If you don't complete verification with your student ID by then, your listings will become unavailable, your plan will be paused, and you may lose your subscription.</p>
      <p>When you complete it, you'll also get the Verified Student badge and 150 App Credit.</p>`,
    buttonText: "Go to verification",
    buttonHref: `${SITE_URL}/kyc`,
  });
}

/** An admin took back a student's verification. `reason` already escaped. */
export function kycRevokedTemplate({ name, reason }) {
  return simpleLayout({
    title: "Your verification has been withdrawn",
    heading: "Your verification has been withdrawn",
    accent: "#dc2626",
    body: `
      <p>Hi ${name},</p>
      <p>Our team has withdrawn your TrybeMarket verification.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>While you're not verified, your listings are unavailable and any plan you have is paused. You can submit your verification again at any time.</p>
      <p>If you think this is a mistake, reply to this email or contact <a href="mailto:contact@trybemarket.online">contact@trybemarket.online</a>.</p>`,
    buttonText: "Verify again",
    buttonHref: `${SITE_URL}/kyc`,
  });
}

/** A reminder before the provisional deadline. Values already escaped. */
export function kycProvisionalReminderTemplate({ name, daysLeft, expiresOn }) {
  const when = Number(daysLeft) === 1 ? "tomorrow" : `in ${daysLeft} days`;
  return simpleLayout({
    title: "Add your student ID to keep selling",
    heading: `Your provisional verification ends ${when}`,
    accent: "#2563eb",
    body: `
      <p>Hi ${name},</p>
      <p>You're provisionally verified on TrybeMarket until <strong>${expiresOn}</strong>.</p>
      <p><strong>Unless you complete verification with your student ID card by then, your listings will become unavailable and your plan will be paused — you may lose your subscription.</strong></p>
      <p>It takes a minute, and you'll also get the Verified Student badge and 150 App Credit.</p>`,
    buttonText: "Add my student ID",
    buttonHref: `${SITE_URL}/kyc`,
  });
}

/** The provisional deadline has passed. Values already escaped. */
export function kycProvisionalExpiredTemplate({ name, expiresOn }) {
  return simpleLayout({
    title: "Your provisional verification has ended",
    heading: "Your provisional verification has ended",
    accent: "#dc2626",
    body: `
      <p>Hi ${name},</p>
      <p>Your provisional verification ended on <strong>${expiresOn}</strong>.</p>
      <p>Your listings are now unavailable to buyers and your plan is paused. If you don't complete verification with your student ID card, you may lose your subscription.</p>
      <p>Submit your student ID and your listings come back straight away, and your plan resumes with the time it had left.</p>`,
    buttonText: "Submit my student ID",
    buttonHref: `${SITE_URL}/kyc`,
  });
}
