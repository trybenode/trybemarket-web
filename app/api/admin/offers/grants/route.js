export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { giftToUsers } from "@/lib/offersAdminServer";

/**
 * POST /api/admin/offers/grants (admin only)
 * { userIds, kind: "plan" | "boost", planId?, durationDays, boostCount?, note? }
 */
export async function POST(req) {
  return withAdmin(req, null, async ({ adminUid }) => giftToUsers(await req.json().catch(() => ({})), { adminUid }));
}
