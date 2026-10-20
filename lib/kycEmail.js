import { Resend } from "resend";
import { adminAuth, adminDB } from "./firebaseAdmin.js";
import { escapeHtml } from "./escapeHtml.js";
import {
  kycSuccessTemplate,
  kycRejectedTemplate,
  kycProvisionalTemplate,
  kycRevokedTemplate,
} from "../emails/kycEmailTemplates.js";

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

const SUBJECTS = {
  verified: "✅ Your Trybe Market KYC Status - Verified!",
  provisional: "🎓 You're provisionally verified on Trybe Market",
  rejected: "⚠️ Your Trybe Market KYC Status - Action Required",
  revoked: "Your Trybe Market verification has been withdrawn",
};

/**
 * Sends a KYC result email: "verified", "provisional" (with `expiresAt`, the
 * deadline to submit a student ID), "rejected" or "revoked". `reason`
 * (rejections and revocations) tells the student why. Throws on failure —
 * callers decide whether that matters.
 */
export async function sendKycEmail({ email, fullName, status, reason = null, expiresAt = null }) {
  // The templates interpolate into HTML as-is, so escape here.
  const name = escapeHtml(fullName);
  const safeReason = reason ? escapeHtml(reason) : null;
  let html;
  if (status === "verified") html = kycSuccessTemplate({ name });
  else if (status === "provisional") {
    const expiresOn = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "the end of your first session";
    html = kycProvisionalTemplate({ name, expiresOn: escapeHtml(expiresOn) });
  } else if (status === "revoked") html = kycRevokedTemplate({ name, reason: safeReason });
  else html = kycRejectedTemplate({ name, reason: safeReason });

  const result = await resend.emails.send({
    from: RESEND_FROM,
    to: email,
    subject: SUBJECTS[status] || SUBJECTS.rejected,
    html,
  });
  // Resend reports API failures by RETURNING { error } rather than throwing.
  if (result?.error) throw new Error(result.error.message || "Resend rejected the email");
  return result;
}
