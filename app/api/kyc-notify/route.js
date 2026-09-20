// app/api/kyc-notify/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { Resend } from "resend";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { escapeHtml } from "@/lib/escapeHtml";
import { RESEND_FROM } from "@/lib/kycEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

// Where the "new KYC request" heads-up goes. Overridable so it can be pointed
// somewhere harmless in tests; the default is unchanged.
const NOTIFY_TO = process.env.KYC_NOTIFY_EMAIL || "trybenode@gmail.com";

/**
 * POST /api/kyc-notify
 *
 * Tells the team a new KYC request is waiting. It used to take userId /
 * fullName / matricNumber from the request body with no login, so anyone could
 * make the company Resend account email the team inbox arbitrary content — and
 * those values went into the HTML unescaped, so a crafted "name" became a
 * phishing link inside an email the team trusts.
 *
 * Now: the caller must be signed in; the details come from THEIR OWN stored
 * pending request (not the body); everything is HTML-escaped; and it fires at
 * most once per submission (a resubmission replaces the request doc, which
 * clears the marker, so a fresh submission can notify again).
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.uid;
  const kycRef = adminDB.collection("kycRequests").doc(userId);

  try {
    // Claim the notification inside a transaction so two concurrent calls
    // can't both send it.
    const claim = await adminDB.runTransaction(async (tx) => {
      const snap = await tx.get(kycRef);
      if (!snap.exists) return { error: "No KYC request found", status: 404 };
      const kyc = snap.data();
      if (kyc.status !== "pending") return { error: "This KYC request is not pending", status: 409 };
      if (kyc.adminNotifiedAt) return { alreadyNotified: true };
      tx.update(kycRef, { adminNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { kyc };
    });

    if (claim.error) return NextResponse.json({ error: claim.error }, { status: claim.status });
    if (claim.alreadyNotified) return NextResponse.json({ success: true, alreadyNotified: true });

    try {
      const result = await resend.emails.send({
        from: RESEND_FROM,
        to: [NOTIFY_TO],
        subject: "New KYC Request Submitted",
        html: `
          <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
          <p><strong>Full Name:</strong> ${escapeHtml(claim.kyc.fullName)}</p>
          <p><strong>Matric Number:</strong> ${escapeHtml(claim.kyc.matricNumber)}</p>
          <p>Check the dashboard for more details.</p>
        `,
      });
      // Resend reports API failures by RETURNING { error } rather than throwing.
      if (result?.error) throw new Error(result.error.message || "Resend rejected the email");
    } catch (sendError) {
      // Release the claim so a retry can try again.
      await kycRef.update({ adminNotifiedAt: admin.firestore.FieldValue.delete() }).catch(() => {});
      throw sendError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email sending error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
