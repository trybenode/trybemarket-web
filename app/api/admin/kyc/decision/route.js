export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { adminDB } from "@/lib/firebaseAdmin";
import {
  KYC_TRACKS,
  KycError,
  claimKeyFor,
  finalizeKyc,
  isValidNormalizedMatric,
  normalizeMatric,
  rejectKyc,
  releaseKycClaim,
  revokeKyc,
} from "@/lib/kycServer";
import { toMillis } from "@/lib/kycAccess";
import { sendKycEmail, resolveKycRecipient } from "@/lib/kycEmail";

const MAX_REASON_LENGTH = 300;
const DECISIONS = ["approve", "reject", "revoke", "releaseClaim"];

/**
 * POST /api/admin/kyc/decision — admin-only, called by the admin app (via its relay).
 *
 *   { userId, decision: "approve", overrideEligibility?, takeOverClaim?, reason? }
 *       ID-card requests are approved as FULL verification; fresher requests
 *       (portal screenshot / library card) as PROVISIONAL. Same transaction
 *       as an automatic decision (lib/kycServer.js finalizeKyc), including
 *       one-number-one-account. A request flagged not eligible needs
 *       `overrideEligibility: true`. If another account holds the number, the
 *       answer is 409 with `conflict` — unless `takeOverClaim: true` with a
 *       `reason`, which moves the claim to this student (logged).
 *   { userId, decision: "reject", reason }       pending requests only
 *   { userId, decision: "revoke", reason }       a provisional or verified student
 *   { decision: "releaseClaim", claimKey, reason }  frees a number claim (logged)
 *
 * Rejections and revocations email the student with the reason.
 */
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { userId, decision } = body;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!DECISIONS.includes(decision)) {
      return NextResponse.json({ error: `decision must be one of ${DECISIONS.join(", ")}` }, { status: 400 });
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json({ error: `reason must be at most ${MAX_REASON_LENGTH} characters` }, { status: 400 });
    }
    const needsReason = decision !== "approve" || body.takeOverClaim === true;
    if (needsReason && reason.length < 3) {
      return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    }

    if (decision === "releaseClaim") {
      if (typeof body.claimKey !== "string" || !body.claimKey) {
        return NextResponse.json({ error: "claimKey is required" }, { status: 400 });
      }
      const result = await releaseKycClaim(body.claimKey, { adminUid: auth.uid, reason });
      return NextResponse.json({ success: true, ...result });
    }

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const [kycSnap, userSnap] = await Promise.all([
      adminDB.collection("kycRequests").doc(userId).get(),
      adminDB.collection("users").doc(userId).get(),
    ]);
    if (!userSnap.exists) {
      // finalizeKyc would otherwise create a stray, empty user doc.
      return NextResponse.json({ error: "This request has no matching user account" }, { status: 404 });
    }
    if (!kycSnap.exists && decision !== "revoke") {
      return NextResponse.json({ error: "KYC request not found" }, { status: 404 });
    }
    const kyc = kycSnap.exists ? kycSnap.data() : {};

    let result;
    if (decision === "approve") {
      if (/^\s*verified\s*$/i.test(String(kyc.status)) && userSnap.data().isVerified === true) {
        return NextResponse.json({ success: true, status: "verified", alreadyVerified: true });
      }
      const isFresher = kyc.track === KYC_TRACKS.FRESHER;
      const notEligible = kyc.eligibility?.eligible === false || kyc.rejectionReason === "not_eligible";
      if (notEligible && body.overrideEligibility !== true) {
        return NextResponse.json(
          { error: "This request was marked not eligible. Confirm the eligibility override to approve it.", needsOverride: true },
          { status: 409 }
        );
      }
      if (!isFresher && (!kyc.matricNumber || !isValidNormalizedMatric(normalizeMatric(kyc.matricNumber)))) {
        return NextResponse.json({ error: "This request has no valid matric number" }, { status: 400 });
      }

      try {
        result = await finalizeKyc(userId, {
          level: isFresher ? "provisional" : "full",
          matricNumber: kyc.matricNumber,
          claimKey: claimKeyFor(kyc.track ? kyc : { ...kyc, track: KYC_TRACKS.ID_CARD }),
          reviewedBy: auth.uid,
          takeOverClaim: body.takeOverClaim === true ? { reason } : null,
          extra: notEligible
            ? { eligibility: { ...(kyc.eligibility || {}), overriddenBy: auth.uid, overrideReason: reason || null } }
            : {},
        });
      } catch (error) {
        if (error instanceof KycError && error.conflict) {
          return NextResponse.json({ error: error.message, conflict: error.conflict }, { status: 409 });
        }
        throw error;
      }
      if (result.status !== "verified" && result.status !== "provisional") {
        return NextResponse.json(
          {
            error: "This matric number is already linked to another verified account, so this request can't be approved",
            rejectionReason: result.rejectionReason,
          },
          { status: 409 }
        );
      }
    } else if (decision === "reject") {
      result = await rejectKyc(userId, { reviewedBy: auth.uid, reason });
    } else {
      result = await revokeKyc(userId, { reviewedBy: auth.uid, reason });
    }

    // The decision is already committed; an email problem must not undo or fail it.
    let emailSent = false;
    try {
      const email = await resolveKycRecipient(userId);
      if (email) {
        const freshUser = result.status === "provisional" ? (await adminDB.collection("users").doc(userId).get()).data() : null;
        await sendKycEmail({
          email,
          fullName: kyc.fullName || userSnap.data().fullName || "",
          status: decision === "revoke" ? "revoked" : result.status,
          // The admin's note tells the student what to fix.
          reason: decision === "approve" ? null : reason,
          expiresAt: freshUser ? toMillis(freshUser.provisionalExpiresAt) : null,
        });
        emailSent = true;
      }
    } catch (emailError) {
      console.error("Error sending manual KYC decision email:", emailError);
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      level: result.level ?? null,
      referralCounted: !!result.referralCounted,
      referralReversed: !!result.referralReversed,
      creditNote: result.creditNote ?? null,
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
