export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { createPromotion } from "@/lib/offersAdminServer";

/**
 * POST /api/admin/offers/promotions (admin only)
 * { name, school, planId, durationDays, cap }
 * To include students already verified at the school, the Offers page then
 * calls POST /api/admin/offers/promotions/[id] { action: "applyToVerified" }
 * until it reports nothing remaining.
 */
export async function POST(req) {
  return withAdmin(req, null, async ({ adminUid }) => {
    const body = await req.json().catch(() => ({}));
    return createPromotion(body, { adminUid });
  });
}
