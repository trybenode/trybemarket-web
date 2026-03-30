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
        <a href="mailto:contact@trybenode.space">contact@trybenode.space</a>.
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

export function kycRejectedTemplate({ name }) {
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
        <a href="mailto:contact@trybenode.space">contact@trybenode.space</a>.
      </p>

      <a href="https://trybemarket.online/kyc" class="retry-button">Retry KYC Verification</a>

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
