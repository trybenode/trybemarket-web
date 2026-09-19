import { adminDB } from "./firebaseAdmin.js";
import { requireAuth } from "./verifyRequestAuth.js";

/**
 * Verified ID token + membership in the `admins` collection (the same
 * definition firestore.rules' isAdmin() uses), checked server-side. The
 * pattern app/api/credit/admin-adjust/route.js already uses, extracted so
 * new admin routes don't each re-implement it.
 *
 * @returns {{ uid: string } | { error: string, status: number }}
 */
export async function requireAdmin(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth;

  const adminSnap = await adminDB.collection("admins").doc(auth.uid).get();
  if (!adminSnap.exists) {
    return { error: "Admin access required", status: 403 };
  }
  return { uid: auth.uid };
}

/** Non-throwing admin check for routes that serve admins AND others differently. */
export async function isAdminUid(uid) {
  const snap = await adminDB.collection("admins").doc(uid).get();
  return snap.exists;
}
