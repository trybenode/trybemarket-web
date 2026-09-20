export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { adminDB } from "@/lib/firebaseAdmin";
import {
  finalizeKyc,
  rejectKyc,
  normalizeMatric,
  isValidNormalizedMatric,
  KycError,
} from "@/lib/kycServer";
import { sendKycEmail, resolveKycRecipient } from "@/lib/kycEmail";

const MAX_REASON_LENGTH = 300;

/**
 * POST /api/admin/kyc/decision  { userId, decision: "approve" | "reject", reason? }
 *
 * Admin-only manual KYC decision, called by the admin app (via its relay). It
 * exists because the admin app used to "approve" by writing
 * kycRequests.status straight from the browser — which never set
 * users.isVerified (firestore.rules only lets the server do that), so a manual
 * approval gave the user no verified status, no 150 credit, no badge, and no
 * CRSA referral count, while every screen showed them as "Verified". Approving
 * here runs the SAME transaction as an OCR approval (lib/kycServer.js
 * finalizeKyc), including the one-matric-one-account check.
 */
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { userId, decision, reason } = await req.json();
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
    }
    if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)) {
      return NextResponse.json({ error: `reason must be text of at most ${MAX_REASON_LENGTH} characters` }, { status: 400 });
    }

    const [kycSnap, userSnap] = await Promise.all([
      adminDB.collection("kycRequests").doc(userId).get(),
      adminDB.collection("users").doc(userId).get(),
    ]);
    if (!kycSnap.exists) {
      return NextResponse.json({ error: "KYC request not found" }, { status: 404 });
    }
    if (!userSnap.exists) {
      // finalizeKyc would otherwise create a stray, empty user doc.
      return NextResponse.json({ error: "This request has no matching user account" }, { status: 404 });
    }
    const kyc = kycSnap.data();

    let result;
    if (decision === "approve") {
      if (/^\s*verified\s*$/i.test(String(kyc.status)) && userSnap.data().isVerified === true) {
        return NextResponse.json({ success: true, status: "verified", alreadyVerified: true });
      }
      if (!kyc.matricNumber || !isValidNormalizedMatric(normalizeMatric(kyc.matricNumber))) {
        return NextResponse.json({ error: "This request has no valid matric number" }, { status: 400 });
      }

      result = await finalizeKyc(userId, {
        ocrStatus: "verified",
        matricNumber: kyc.matricNumber,
        reviewedBy: auth.uid,
      });

      if (result.status !== "verified") {
        return NextResponse.json(
          {
            error: "This matric number is already linked to another verified account, so this request can't be approved",
            rejectionReason: result.rejectionReason,
          },
          { status: 409 }
        );
      }
    } else {
      result = await rejectKyc(userId, { reviewedBy: auth.uid, reason: reason?.trim() });
    }

    // The decision is already committed; an email problem must not undo or fail it.
    let emailSent = false;
    try {
      const email = await resolveKycRecipient(userId);
      if (email) {
        await sendKycEmail({ email, fullName: kyc.fullName, status: result.status });
        emailSent = true;
      }
    } catch (emailError) {
      console.error("Error sending manual KYC decision email:", emailError);
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      referralCounted: !!result.referralCounted,
      emailSent,
    });
  } catch (error) {
    if (error instanceof KycError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error recording manual KYC decision:", error);
    return NextResponse.json({ error: "Failed to record the decision" }, { status: 500 });
  }
}
