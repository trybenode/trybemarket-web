export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { isAdminUid } from "@/lib/requireAdmin";
import { adminDB } from "@/lib/firebaseAdmin";
import { getLeaderboard } from "@/lib/crsaServer";

/**
 * GET /api/crsa/leaderboard
 *
 * Visible to admins and to ACTIVE CRSA members only — anyone else gets 403.
 * The two audiences get different shapes on purpose (see getLeaderboard):
 * admins see every member with uid/code/active; members see only active
 * members' names and counts, never uids or referral codes.
 */
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const admin = await isAdminUid(auth.uid);
    if (!admin) {
      const memberSnap = await adminDB.collection("crsaMembers").doc(auth.uid).get();
      if (!memberSnap.exists || !memberSnap.data().active) {
        return NextResponse.json({ error: "The leaderboard is only visible to CRSA members" }, { status: 403 });
      }
    }

    const leaderboard = await getLeaderboard({ forAdmin: admin, viewerUid: auth.uid });
    return NextResponse.json({ success: true, isAdmin: admin, leaderboard });
  } catch (error) {
    console.error("Error fetching CRSA leaderboard:", error);
    return NextResponse.json({ error: "Failed to load the leaderboard", details: error.message }, { status: 500 });
  }
}
