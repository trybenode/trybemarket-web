export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { getOffersOverview } from "@/lib/offersAdminServer";

/** GET /api/admin/offers — giftable plans, promotions and recent gifts (admin only). */
export async function GET(req) {
  return withAdmin(req, null, () => getOffersOverview());
}
