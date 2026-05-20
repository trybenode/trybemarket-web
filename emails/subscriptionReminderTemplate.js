/**
 * Email template for subscription renewal reminders.
 * Sent at 7-day, 3-day, and 1-day marks before a plan expires.
 */
export function subscriptionReminderTemplate({
  name,
  planName,
  daysLeft,
  formattedExpiry,
  losses,
  renewUrl,
}) {
  const urgencyColor = daysLeft === 1 ? "#e53e3e" : daysLeft <= 3 ? "#dd6b20" : "#d69e2e";
  const urgencyLabel =
    daysLeft === 1 ? "EXPIRES TOMORROW" : `EXPIRES IN ${daysLeft} DAYS`;

  const lossItems = losses
    .map(
      (item) =>
        `<li style="margin-bottom:8px;padding-left:4px;">${item}</li>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Renew Your TrybeMarket Subscription</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,sans-serif;color:#1a365d;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:30px 20px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:10px;border:1px solid #bee3f8;box-shadow:0 2px 10px rgba(0,0,0,0.06);overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background-color:#2b6cb0;padding:24px 30px;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                  TrybeMarket
                </p>
                <p style="margin:6px 0 0;font-size:13px;color:#bee3f8;">The campus marketplace</p>
              </td>
            </tr>

            <!-- Urgency banner -->
            <tr>
              <td style="background-color:${urgencyColor};padding:12px 30px;text-align:center;">
                <p style="margin:0;color:#ffffff;font-weight:bold;font-size:14px;letter-spacing:1px;">
                  ⚠️ ${urgencyLabel}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 16px;font-size:16px;">Hi ${name},</p>

                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                  Your <strong>${planName}</strong> subscription is expiring on
                  <strong>${formattedExpiry}</strong>.
                  That's only <strong style="color:${urgencyColor};">${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> away.
                </p>

                <p style="margin:0 0 12px;font-size:15px;font-weight:bold;">
                  What you'll lose if you don't renew:
                </p>

                <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#2d3748;">
                  ${lossItems}
                </ul>

                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a5568;">
                  Renewing keeps all your listings active, your seller badge visible, and your shop
                  performing at full capacity. Don't let your hard work disappear overnight.
                </p>

                <!-- CTA -->
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <a
                        href="${renewUrl}"
                        style="display:inline-block;background-color:#2b6cb0;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;"
                      >
                        Renew My Subscription →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:13px;color:#718096;text-align:center;">
                  Or copy this link into your browser:<br />
                  <a href="${renewUrl}" style="color:#2b6cb0;">${renewUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#ebf8ff;padding:20px 30px;border-top:1px solid #bee3f8;">
                <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.6;">
                  You're receiving this because you have an active subscription on TrybeMarket.
                  Questions? Reply to this email or visit
                  <a href="https://trybemarket.online" style="color:#2b6cb0;">trybemarket.online</a>.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
