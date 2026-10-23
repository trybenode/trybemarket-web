import { NextResponse } from "next/server";
import { requireAdmin } from "./requireAdmin.js";
import { GrantError } from "./planGrantServer.js";

/** Runs an admin-only offers handler: verifies the admin, maps errors to JSON. */
export async function withAdmin(req, context, run) {
  const auth = await requireAdmin(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await run({ adminUid: auth.uid, req, context }));
  } catch (error) {
    if (error instanceof GrantError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Offers admin route failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
