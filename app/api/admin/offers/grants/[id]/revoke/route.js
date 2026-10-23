export const runtime = "nodejs";

import { withAdmin } from "@/lib/offersRoute";
import { revokeGrant } from "@/lib/planGrantServer";

/** POST /api/admin/offers/grants/[id]/revoke — take back a gift or promotion grant (admin only). */
export async function POST(req, context) {
  return withAdmin(req, context, async ({ adminUid }) => {
    const { id } = await context.params;
    return revokeGrant(id, { adminUid });
  });
}
