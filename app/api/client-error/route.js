// app/api/client-error/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";

/**
 * POST /api/client-error
 *
 * Records a failure that happened in the user's browser, so it can be traced.
 * Flows like KYC fail on the student's phone before any server call (photo
 * upload, Firestore save), which used to leave nothing in the Vercel logs —
 * just a generic toast on a device we can't see.
 *
 * Signed-in users only, and every field is length-capped, so this can't be
 * used to dump arbitrary data. Stored in `clientErrors` (no client rule —
 * Admin SDK only) and echoed to the function log.
 */
const cap = (v, n) => (v == null ? null : String(v).slice(0, n));

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const files = Array.isArray(body.files) ? body.files.slice(0, 4) : [];
  const report = {
    userId: auth.uid,
    where: cap(body.where, 50),
    step: cap(body.step, 100),
    errorName: cap(body.errorName, 100),
    errorMessage: cap(body.errorMessage, 1000),
    errorCode: cap(body.errorCode, 100),
    files: files.map((f) => ({
      type: cap(f?.type, 50),
      size: Number.isFinite(f?.size) ? f.size : null,
    })),
    online: typeof body.online === "boolean" ? body.online : null,
    userAgent: cap(req.headers.get("user-agent"), 300),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.error("Client error:", JSON.stringify({ ...report, createdAt: undefined }));

  try {
    await adminDB.collection("clientErrors").add(report);
  } catch (error) {
    console.error("Failed to store client error:", error);
  }
  return NextResponse.json({ success: true });
}
