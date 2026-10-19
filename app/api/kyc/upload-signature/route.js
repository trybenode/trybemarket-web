// app/api/kyc/upload-signature/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { KYC_PHOTO_SLOTS, signKycUpload } from "@/lib/kycPhotos";

/**
 * POST /api/kyc/upload-signature  { slot: "front" | "back" | "selfie" }
 *
 * Signs one KYC photo upload for the signed-in user, so the browser can send
 * it straight to Cloudinary. The server decides everything that matters —
 * where it's stored (kyc/<uid>/<slot>-<random>), that it's private, allowed
 * formats and a size cap — and the signature covers all of it.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await req.json().catch(() => ({}));
  if (!KYC_PHOTO_SLOTS.includes(body.slot)) {
    return NextResponse.json({ error: "slot must be front, back or selfie" }, { status: 400 });
  }
  try {
    return NextResponse.json(signKycUpload(auth.uid, body.slot));
  } catch (error) {
    console.error("KYC upload signature error:", error);
    return NextResponse.json({ error: "Couldn't prepare the upload — please try again." }, { status: 500 });
  }
}
