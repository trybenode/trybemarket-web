export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { applyPromotionToVerified, updatePromotion } from "@/lib/offersAdminServer";

/**
 * POST /api/admin/offers/promotions/[id] (admin only)
 * { action: "pause" | "resume" | "end" | "setCap" | "applyToVerified", cap? }
 */
export async function POST(req, context) {
  return withAdmin(req, context, async () => {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    if (body.action === "applyToVerified") return { applied: await applyPromotionToVerified(id) };
    return updatePromotion(id, body);
  });
}
