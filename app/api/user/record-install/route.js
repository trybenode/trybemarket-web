export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { recordInstall } from "@/lib/pwaServer";

/**
 * Called by the installed app (components/PwaBootstrap.jsx) once per user per
 * device. Identity comes from the verified token, never the body; the body
 * only carries allow-listed `platform` / `source` labels. Safe to call any
 * number of times — see recordInstall.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await recordInstall(auth.uid, { platform: body?.platform, source: body?.source });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error recording app install:", error);
    return NextResponse.json({ error: "Failed to record install" }, { status: 500 });
  }
}
