"use client";

import { getAuth } from "firebase/auth";

/**
 * Browser-side KYC photo handling, shared by the ID-card and fresher routes
 * on /kyc and by the selfie capture.
 */

// GIFs are accepted when picked but re-encoded to JPEG (preparePhoto) — only
// JPEG and PNG are stored.
export const PICKABLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const MAX_PICKED_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_SIDE = 2000;

/**
 * Sends a failure from the KYC page to /api/client-error, so it shows up in
 * the Vercel logs and Firestore `clientErrors` instead of only in the
 * student's browser. Best-effort: never throws.
 */
export function reportKycClientError(step, error, files = []) {
  getAuth().currentUser?.getIdToken()
    .then((idToken) =>
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          where: "kyc",
          step,
          errorName: error?.name,
          errorMessage: error?.message,
          errorCode: error?.code,
          files: files.map((f) => ({ type: f?.type, size: f?.size })),
          online: navigator.onLine,
        }),
      })
    )
    .catch(() => {});
}

/**
 * Copies a photo into memory as a JPEG no larger than MAX_PHOTO_SIDE on its
 * longest side. On Android, Chrome can fail to read a gallery/Google Photos
 * pick again at upload time (ERR_UPLOAD_FILE_CHANGED, surfacing as "Failed to
 * fetch") even though the preview showed; an in-memory copy can't go stale.
 * It also keeps uploads small on slow data while leaving text sharp enough
 * for OCR.
 */
export async function preparePhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't re-encode the photo"))), "image/jpeg", 0.9)
    );
    return new File([blob], "kyc-photo.jpg", { type: "image/jpeg" });
  } catch (error) {
    // Couldn't decode it here — fall back to a plain in-memory copy (this
    // throws too if the phone can't read the file at all).
    reportKycClientError("preparing the photo (fell back to a plain copy)", error, [file]);
    return new File([await file.arrayBuffer()], file.name, { type: file.type });
  }
}

/**
 * Checks and prepares a picked file. Returns the in-memory photo, or throws
 * an Error whose message is shown to the student.
 */
export async function acceptPickedPhoto(file) {
  if (!PICKABLE_IMAGE_TYPES.includes(file.type)) throw new Error("Only JPEG, PNG, or GIF images are allowed.");
  if (file.size > MAX_PICKED_BYTES) throw new Error("Image size must be less than 5MB.");
  try {
    return await preparePhoto(file);
  } catch (error) {
    reportKycClientError("reading the picked photo", error, [file]);
    throw new Error(
      "We couldn't read that photo. Take a new photo with your camera, or save it to your phone first, then pick it again."
    );
  }
}

/** Opens the file picker; resolves with the picked File, or null if cancelled. */
export function pickFile({ accept = "image/*", capture } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.setAttribute("capture", capture);
    input.onchange = (event) => resolve(event.target.files?.[0] || null);
    input.click();
  });
}

/**
 * Uploads one photo privately to Cloudinary — straight from the browser with
 * a signature from our server, or through our server (/api/kyc-upload) when
 * the browser can't reach Cloudinary at all: some students' networks reach
 * our site but not api.cloudinary.com. Either way the server decides where it
 * goes (the student's own kyc/<uid>/ folder), that it's private, and the
 * allowed formats and size.
 *
 * @param {"front"|"back"|"selfie"} slot
 * @returns {Promise<{ publicId, version, signature }>} — what /api/kyc-submit expects
 */
export async function uploadKycPhoto(file, slot) {
  const idToken = await getAuth().currentUser.getIdToken();
  const signResponse = await fetch("/api/kyc/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ slot }),
  });
  const signed = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok || !signed.uploadUrl) {
    throw new Error(signed.error || `couldn't prepare the upload (${signResponse.status})`);
  }

  const data = new FormData();
  data.append("file", file);
  Object.entries(signed.params).forEach(([key, value]) => data.append(key, value));

  let res;
  try {
    const response = await fetch(signed.uploadUrl, { method: "POST", body: data });
    res = await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    // Recorded even when the retry below works, so we can see how often it's needed.
    reportKycClientError("uploading straight to Cloudinary (retrying through our server)", error, [file]);
    return uploadThroughServer(file, slot);
  }
  if (!res.public_id || !res.signature) {
    // Keep Cloudinary's own reason (file too large, format not allowed…).
    console.error("Cloudinary Upload Error:", res.error);
    throw new Error(res.error?.message || "the image server rejected the photo");
  }
  return { publicId: res.public_id, version: res.version, signature: res.signature };
}

async function uploadThroughServer(file, slot) {
  const idToken = await getAuth().currentUser.getIdToken();
  const data = new FormData();
  data.append("file", file);
  data.append("slot", slot);
  let response;
  try {
    response = await fetch("/api/kyc-upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: data,
    });
  } catch (error) {
    // Keep the browser's own error: "Failed to fetch" (no connection) and
    // NotReadableError (the phone couldn't read the photo) need different fixes.
    throw new Error(`couldn't upload the photo (${error?.name}: ${error?.message})`);
  }
  const res = await response.json().catch(() => ({}));
  if (!response.ok || !res.publicId) {
    throw new Error(res.error || `the upload failed (${response.status})`);
  }
  return res;
}
