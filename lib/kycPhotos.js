import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

/**
 * Private KYC photos (server-only — needs CLOUDINARY_API_SECRET).
 *
 * KYC photos used to be uploaded with an unsigned preset to PUBLIC delivery
 * URLs: anyone with a link could open a student's ID. Now:
 *
 * - The server issues a signature for each upload, fixing where it goes
 *   (kyc/<uid>/<slot>-<random>), that it's stored as type "authenticated"
 *   (private), which formats are allowed, and a size cap. These are all
 *   covered by the signature, so the browser can't change them.
 * - A submitted photo is checked with the signature Cloudinary returns with
 *   every upload. That signature covers ONLY the public ID and version: it
 *   proves Cloudinary stored that asset in our account, nothing more. Format,
 *   type and size are trusted because they were fixed when the upload was
 *   signed, and the bytes are re-checked whenever the server reads a photo.
 * - Photos are read only on the server, through signed URLs that never leave
 *   it: for the automatic check, and streamed to admins (each view logged).
 */

export const KYC_PHOTO_SLOTS = ["front", "back", "selfie"];
const ALLOWED_FORMATS = "jpg,jpeg,png";
// Incoming transformation: whatever is uploaded, Cloudinary stores at most
// 2000px on the longest side — plenty for OCR and review, and a size cap.
const INCOMING_TRANSFORMATION = "c_limit,w_2000,h_2000";
const INCOMING_TRANSFORMATION_SDK = { crop: "limit", width: 2000, height: 2000 };
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PUBLIC_ID_RANDOM = /^[a-f0-9]{32}$/;

let configured = false;
function cloud() {
  if (!configured) {
    const { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary is not configured (CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)");
    }
    cloudinary.config({
      cloud_name: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
      urlAnalytics: false,
    });
    configured = true;
  }
  return cloudinary;
}

/** Upload parameters for one KYC photo — what gets signed. */
function uploadParams(uid, slot) {
  const params = {
    public_id: `kyc/${uid}/${slot}-${crypto.randomUUID().replace(/-/g, "")}`,
    type: "authenticated",
    allowed_formats: ALLOWED_FORMATS,
    transformation: INCOMING_TRANSFORMATION,
    timestamp: Math.round(Date.now() / 1000),
  };
  // Optional dedicated signed preset (e.g. with a max file size set in Cloudinary).
  if (process.env.CLOUDINARY_KYC_PRESET) params.upload_preset = process.env.CLOUDINARY_KYC_PRESET;
  return params;
}

/**
 * A signature for the browser to upload one KYC photo straight to Cloudinary.
 * The returned `params` must be sent exactly as given, with the file.
 */
export function signKycUpload(uid, slot) {
  if (!KYC_PHOTO_SLOTS.includes(slot)) throw new Error("Unknown photo slot");
  const c = cloud();
  const params = uploadParams(uid, slot);
  const signature = c.utils.api_sign_request(params, c.config().api_secret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${c.config().cloud_name}/image/upload`,
    params: { ...params, api_key: c.config().api_key, signature },
  };
}

/**
 * Uploads one KYC photo from the server (the fallback when the browser can't
 * reach Cloudinary) with the same parameters as a browser upload.
 *
 * @returns {Promise<{ publicId: string, version: number, signature: string }>}
 */
export function uploadKycPhoto(uid, slot, bytes) {
  if (!KYC_PHOTO_SLOTS.includes(slot)) throw new Error("Unknown photo slot");
  const c = cloud();
  // The SDK signs and timestamps itself — and reads a plain-string
  // `transformation` as the NAME of a saved transformation, so the same
  // 2000px cap is given in its object form here.
  const { timestamp, transformation, ...params } = uploadParams(uid, slot);
  params.transformation = INCOMING_TRANSFORMATION_SDK;
  return new Promise((resolve, reject) => {
    const stream = c.uploader.upload_stream(params, (error, result) => {
      if (error) return reject(new Error(error.message || "Upload failed"));
      resolve({ publicId: result.public_id, version: result.version, signature: result.signature });
    });
    stream.end(bytes);
  });
}

/**
 * Checks a submitted photo: in the caller's own folder, in the right slot, and
 * really stored by Cloudinary in our account (the upload-response signature).
 *
 * @param {{ publicId: string, version: number|string, signature: string }} photo
 * @returns {{ publicId: string, version: number } | null} what to store, or null if it fails
 */
export function verifyKycPhoto(photo, uid, slot) {
  if (!photo || typeof photo !== "object") return null;
  const { publicId, version, signature } = photo;
  if (typeof publicId !== "string" || typeof signature !== "string" || !/^[0-9]{1,13}$/.test(String(version))) {
    return null;
  }
  const parts = publicId.split("/");
  if (parts.length !== 3 || parts[0] !== "kyc" || parts[1] !== uid) return null;
  const [kind, random, ...extra] = parts[2].split("-");
  if (extra.length || kind !== slot || !PUBLIC_ID_RANDOM.test(random || "")) return null;

  const c = cloud();
  const expected = c.utils.api_sign_request({ public_id: publicId, version: String(version) }, c.config().api_secret, null, 1);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return { publicId, version: Number(version) };
}

/**
 * Reads a private KYC photo's bytes (server-side only) and re-checks them:
 * an image content type and a size cap, whatever the upload claimed.
 *
 * @returns {Promise<{ bytes: Buffer, contentType: string }>}
 */
export async function readKycPhoto({ publicId, version }, { timeoutMs = 10_000 } = {}) {
  const c = cloud();
  const url = c.url(publicId, { type: "authenticated", sign_url: true, secure: true, version });
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Couldn't load a photo (${response.status})`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("A stored photo isn't an image");
  if (Number(response.headers.get("content-length") || 0) > MAX_PHOTO_BYTES) throw new Error("A photo is too large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("A photo is too large");
  return { bytes, contentType };
}
