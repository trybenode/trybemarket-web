export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ListingError, createListing } from "@/lib/listingServer";
import { requireAuth } from "@/lib/verifyRequestAuth";

/**
 * POST /api/listing/create  { itemType: "product"|"service", listing: {…}, isVip? }
 *
 * The only way a listing is created (firestore.rules refuses direct creates
 * from the browser): the seller's KYC, their plan's listing limit and the
 * listing's fields are all checked here — see lib/listingCore.js.
 *
 *   200 { id, isVip, vipError }      vipError: why a requested VIP tag wasn't applied
 *   400 { error, code: "invalid" }
 *   403 { error, code: "kyc_required" | "limit_reached" }
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request.", code: "invalid" }, { status: 400 });
  }

  try {
    const result = await createListing(auth.uid, body?.itemType, body?.listing, { isVip: body?.isVip === true, source: "web" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ListingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Error creating listing:", error);
    return NextResponse.json({ error: "Couldn't save your listing. Please try again." }, { status: 500 });
  }
}
