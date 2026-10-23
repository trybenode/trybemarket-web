export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { applyPromotionToVerified, createPromotion } from "@/lib/offersAdminServer";

/**
 * POST /api/admin/offers/promotions (admin only)
 * { name, school, planId, durationDays, cap, applyToVerified? }
 * applyToVerified gives it straight away to students already verified at the
 * school, earliest verification first.
 */
export async function POST(req) {
  return withAdmin(req, null, async ({ adminUid }) => {
    const body = await req.json().catch(() => ({}));
    const { id } = await createPromotion(body, { adminUid });
    const applied = body.applyToVerified ? await applyPromotionToVerified(id) : null;
    return { id, applied };
  });
}
