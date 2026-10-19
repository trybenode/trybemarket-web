// app/api/admin/kyc/photo/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import { KYC_PHOTO_SLOTS, readKycPhoto } from "@/lib/kycPhotos";

/**
 * GET /api/admin/kyc/photo?userId=…&photo=front|back|selfie
 *
 * Streams one private KYC photo to an admin (via the admin app's relay).
 * KYC photos are never publicly addressable: this is the only way to view
 * one, and every view is recorded in kycAccessLog — who, which photo, when —
 * because the photos are kept for as long as the account needs them.
 */
export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "";
  const slot = searchParams.get("photo") || "";
  if (!userId || !KYC_PHOTO_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "userId and photo (front, back or selfie) are required" }, { status: 400 });
  }

  try {
    const snap = await adminDB.collection("kycRequests").doc(userId).get();
    const photo = snap.exists ? snap.data().photos?.[slot] : null;
    if (!photo?.publicId) {
      return NextResponse.json({ error: "No such photo on this request" }, { status: 404 });
    }

    await adminDB.collection("kycAccessLog").add({
      adminUid: auth.uid,
      userId,
      photo: slot,
      publicId: photo.publicId,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const { bytes, contentType } = await readKycPhoto(photo);
    return new NextResponse(bytes, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    console.error("Admin KYC photo error:", error);
    return NextResponse.json({ error: "Couldn't load the photo" }, { status: 502 });
  }
}
