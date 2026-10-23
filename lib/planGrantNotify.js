import { Resend } from "resend";
import { adminDB } from "./firebaseAdmin.js";
import { escapeHtml } from "./escapeHtml.js";
import { RESEND_FROM, resolveKycRecipient } from "./kycEmail.js";
import { planGrantTemplate } from "../emails/planGrantTemplate.js";

/**
 * Tells a student a promotion gave them a plan (09-offers.md): an email
 * always, and a WhatsApp message if they have WhatsApp alerts on and the
 * template is set up. This is an account notice (like a KYC result), not a
 * promotion, so it doesn't depend on the marketing opt-ins.
 *
 * WhatsApp needs an approved Utility template named by
 * WHATSAPP_PLAN_GIFT_TEMPLATE with the named variables customer_name,
 * plan_name, duration_text and end_date; without it, only the email is sent.
 *
 * Never throws: a failed message must not undo or block a grant.
 * Returns { email: "sent" | "failed" | "no_address", whatsapp: "sent" | "failed" | "off" | "not_configured" }.
 */

const resend = new Resend(process.env.RESEND_API_KEY);
const WHATSAPP_API_URL = (process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0").replace(/\/$/, "");
const WHATSAPP_NUMBER_RE = /^234[789]\d{9}$/;

const firstName = (fullName) => {
  const word = String(fullName || "").trim().split(/\s+/)[0] || "";
  return word && (word === word.toUpperCase() || word === word.toLowerCase())
    ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    : word;
};

const durationText = (days) =>
  days % 30 === 0 && days >= 30 ? `${days / 30} month${days === 30 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"}`;

const readableDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// What the plan gives, for the email. A bundle's own list is just "Premium
// Products plan" etc., so list the features of the plans it includes.
async function planFeatures(plan) {
  if (!Array.isArray(plan.includes) || plan.includes.length === 0) return (plan.features || []).slice(0, 7);
  const snaps = await adminDB.getAll(...plan.includes.map((id) => adminDB.collection("subscriptionPlans").doc(id)));
  const merged = snaps.flatMap((s) => (s.exists ? s.data().features || [] : []));
  return [...new Set(merged)].slice(0, 7);
}

async function sendWhatsApp({ to, values }) {
  const template = process.env.WHATSAPP_PLAN_GIFT_TEMPLATE;
  if (!template || !process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return "not_configured";
  const response = await fetch(`${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_PLAN_GIFT_TEMPLATE_LANG || "en" },
        components: [{
          type: "body",
          parameters: Object.entries(values).map(([parameter_name, text]) => ({ type: "text", parameter_name, text })),
        }],
      },
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Plan gift WhatsApp failed:", JSON.stringify(error.error || error).slice(0, 300));
    return "failed";
  }
  return "sent";
}

export async function notifyPlanGrant(uid, { plan, durationDays, expiresAt, action }) {
  const outcome = { email: "no_address", whatsapp: "off" };
  try {
    const user = (await adminDB.collection("users").doc(uid).get()).data() || {};
    const name = firstName(user.fullName) || "there";
    const school = user.selectedUniversity || "";

    // Email
    try {
      const to = await resolveKycRecipient(uid);
      if (to) {
        const html = planGrantTemplate({
          name: escapeHtml(name),
          planName: escapeHtml(plan.name),
          durationText: escapeHtml(durationText(durationDays)),
          endsOn: escapeHtml(readableDate(expiresAt)),
          school: escapeHtml(school),
          features: (await planFeatures(plan)).map(escapeHtml),
          extended: action === "extended",
        });
        const result = await resend.emails.send({
          from: RESEND_FROM,
          to,
          subject: action === "extended"
            ? `Your ${plan.name} plan has been extended for free`
            : `You've got ${plan.name} free on TrybeMarket`,
          html,
        });
        outcome.email = result?.error ? "failed" : "sent";
        if (result?.error) console.error("Plan gift email failed:", result.error.message);
      }
    } catch (error) {
      outcome.email = "failed";
      console.error("Plan gift email failed:", error.message);
    }

    // WhatsApp — only to people who turned WhatsApp alerts on
    const phone = String(user.phone || "").replace(/\D/g, "");
    if (user.whatsappNotifications === true && WHATSAPP_NUMBER_RE.test(phone)) {
      try {
        outcome.whatsapp = await sendWhatsApp({
          to: phone,
          values: {
            customer_name: name,
            plan_name: plan.name,
            duration_text: durationText(durationDays),
            end_date: readableDate(expiresAt),
          },
        });
      } catch (error) {
        outcome.whatsapp = "failed";
        console.error("Plan gift WhatsApp failed:", error.message);
      }
    }
  } catch (error) {
    console.error(`Plan gift notification for ${uid} failed:`, error);
  }
  return outcome;
}
