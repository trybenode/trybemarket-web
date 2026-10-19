import admin from "firebase-admin";
import { Resend } from "resend";
import { adminDB } from "./firebaseAdmin.js";
import { escapeHtml } from "./escapeHtml.js";
import { RESEND_FROM } from "./kycEmail.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Where the "a KYC request needs review" heads-up goes. Overridable so it can
// be pointed somewhere harmless in tests.
const NOTIFY_TO = process.env.KYC_NOTIFY_EMAIL || "trybenode@gmail.com";

/**
 * Emails the team that a KYC request is waiting in the admin Pending queue —
 * called by app/api/kyc-submit only when the automatic check couldn't decide
 * (it used to fire for every submission, including ones verified seconds
 * later, from a client-called /api/kyc-notify).
 *
 * Details come from the STORED request, everything is HTML-escaped, and it
 * fires at most once per submission: the claim (adminNotifiedAt) is taken in a
 * transaction, and a resubmission writes a fresh request, which clears it.
 *
 * @param {string} userId
 * @param {string} why - one line for the email, e.g. "Name 1/3 words · matric not found"
 * @returns {Promise<boolean>} whether an email was sent
 */
export async function notifyTeamOfKycReview(userId, why) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);

  const claim = await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    if (!snap.exists) return null;
    const kyc = snap.data();
    if (kyc.status !== "pending" || kyc.adminNotifiedAt) return null;
    tx.update(kycRef, { adminNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    return kyc;
  });
  if (!claim) return false;

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: [NOTIFY_TO],
      subject: "KYC request needs review",
      html: `
        <p>A KYC request couldn't be confirmed automatically and is waiting in the admin Pending queue.</p>
        <p><strong>Why:</strong> ${escapeHtml(why)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>Full Name:</strong> ${escapeHtml(claim.fullName)}</p>
        <p><strong>Matric Number:</strong> ${escapeHtml(claim.matricNumber)}</p>
      `,
    });
    // Resend reports API failures by RETURNING { error } rather than throwing.
    if (result?.error) throw new Error(result.error.message || "Resend rejected the email");
    return true;
  } catch (error) {
    // Release the claim so a later attempt can notify.
    await kycRef.update({ adminNotifiedAt: admin.firestore.FieldValue.delete() }).catch(() => {});
    throw error;
  }
}
