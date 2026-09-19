import { adminAuth } from "./firebaseAdmin";

/**
 * Verifies the `Authorization: Bearer <idToken>` header on an App Router
 * Request. Never trust a client-supplied uid for a privileged write — this
 * is the only source of truth for "who is calling."
 */
export async function requireAuth(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return { error: "Missing authorization token", status: 401 };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return { error: "Invalid or expired session", status: 401 };
  }
}
