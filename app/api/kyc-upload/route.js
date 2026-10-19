// app/api/kyc-upload/route.js
export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
// Under Vercel's 4.5MB request limit; the KYC page sends photos already
// downscaled to a ~2000px JPEG, which is far smaller than this.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/kyc-upload   (multipart: file)
 *
 * Uploads a KYC ID photo to Cloudinary on the student's behalf. The KYC page
 * uploads straight to Cloudinary first and only falls back to this when the
 * browser can't reach api.cloudinary.com at all ("Failed to fetch") — some
 * students' networks reach our site but not Cloudinary. Same unsigned preset,
 * and the same kyc/<uid>/<random> location (public_id), as the browser upload —
 * /api/kyc-submit only accepts photos from the caller's own folder.
 *
 * Signed-in users only, images only, size-capped — so it can't be used as an
 * open upload relay into our Cloudinary account.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let file;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Expected a photo upload" }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Expected a photo upload" }, { status: 400 });
  }
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or GIF images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_PRESET);
  data.append("public_id", `kyc/${auth.uid}/${crypto.randomUUID().replace(/-/g, "")}`);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: data }
    );
    const res = await response.json().catch(() => ({}));
    if (!res.secure_url) {
      console.error("KYC upload: Cloudinary rejected the photo:", res.error);
      return NextResponse.json(
        { error: res.error?.message || "The image server rejected the photo" },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: res.secure_url });
  } catch (error) {
    console.error("KYC upload error:", error);
    return NextResponse.json({ error: "Couldn't reach the image server" }, { status: 502 });
  }
}
