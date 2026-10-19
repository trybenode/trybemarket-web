// app/api/kyc-upload/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { KYC_PHOTO_SLOTS, uploadKycPhoto } from "@/lib/kycPhotos";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png"];
// Under Vercel's 4.5MB request limit; the KYC page sends photos already
// downscaled to a ~2000px JPEG, which is far smaller than this.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/kyc-upload   (multipart: file, slot)
 *
 * Uploads a KYC photo to Cloudinary on the student's behalf. The KYC page
 * uploads straight to Cloudinary first (with a signature from
 * /api/kyc/upload-signature) and only falls back to this when the browser
 * can't reach api.cloudinary.com at all ("Failed to fetch") — some students'
 * networks reach our site but not Cloudinary. Same parameters as the browser
 * upload: private, in the caller's own kyc/<uid>/ folder, size-capped.
 *
 * Signed-in users only, images only — not an open upload relay.
 *
 * @returns {{ publicId, version, signature }} — what /api/kyc-submit expects
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a photo upload" }, { status: 400 });
  }
  const file = form.get("file");
  const slot = form.get("slot");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Expected a photo upload" }, { status: 400 });
  }
  if (!KYC_PHOTO_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "slot must be front, back or selfie" }, { status: 400 });
  }
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG or PNG images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  try {
    const photo = await uploadKycPhoto(auth.uid, slot, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(photo);
  } catch (error) {
    console.error("KYC upload error:", error);
    return NextResponse.json({ error: error.message || "Couldn't upload the photo" }, { status: 502 });
  }
}
