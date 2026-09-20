import { Resend } from "resend";
import { adminAuth, adminDB } from "./firebaseAdmin.js";
import { escapeHtml } from "./escapeHtml.js";
import { kycSuccessTemplate, kycRejectedTemplate } from "../emails/kycEmailTemplates.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// The sender must be on a domain verified in Resend, or every send is rejected
// with a 403 ("domain is not verified"). Configurable so it can be corrected
// (e.g. after a domain change) without a code change; the default is unchanged.
export const RESEND_FROM = process.env.RESEND_FROM || "Trybe Market <contact@trybemarket.online>";

/**
 * The address a KYC result email goes to: the account's OWN verified email,
 * looked up server-side. It used to be an `email` field in the request body,
 * which let anyone aim a KYC-branded email — with attacker-chosen HTML in the
 * name — at any address through the company sender.
 */
export async function resolveKycRecipient(userId) {
  try {
    const authUser = await adminAuth.getUser(userId);
    if (authUser.email) return authUser.email;
  } catch {
    // fall through to the profile doc
  }
  const userSnap = await adminDB.collection("users").doc(userId).get();
  return userSnap.exists ? userSnap.data().email || null : null;
}

/** Sends the verified/rejected KYC email. Throws on failure — callers decide whether that matters. */
export async function sendKycEmail({ email, fullName, status }) {
  const isVerified = status === "verified";
  // The templates interpolate the name into HTML as-is, so escape it here.
  const name = escapeHtml(fullName);
  const html = isVerified ? kycSuccessTemplate({ name }) : kycRejectedTemplate({ name });

  const result = await resend.emails.send({
    from: RESEND_FROM,
    to: email,
    subject: isVerified
      ? "✅ Your Trybe Market KYC Status - Verified!"
      : "⚠️ Your Trybe Market KYC Status - Action Required",
    html,
  });
  // Resend reports API failures by RETURNING { error } rather than throwing.
  if (result?.error) throw new Error(result.error.message || "Resend rejected the email");
  return result;
}
