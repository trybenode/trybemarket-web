import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * APP CREDIT SYSTEM — see 01-app-credit-system.md
 *
 * Credit is earned only through server-side triggers (KYC completion, confirmed
 * sales, weekly streak) and spent as a discount at checkout. It is never a
 * client-writable field — see firestore.rules for the enforcement of that.
 */

export const CREDIT_EVENT_TYPES = {
  KYC_VERIFICATION_COMPLETE: "kyc_verification_complete",
  CONFIRMED_SALE: "confirmed_sale",
  WEEKLY_ACTIVE_STREAK: "weekly_active_streak",
  SPEND_BOOST: "spend_boost",
  SPEND_PREMIUM_PLAN: "spend_premium_plan",
  SPEND_COSMETIC_FRAME: "spend_cosmetic_frame",
  ADMIN_ADJUSTMENT: "admin_adjustment",
};

/**
 * Max % of a plan's price that credit can cover, keyed by planId category/type.
 * bundle_yearly is a deliberate exception to the standard bundle/premium rate —
 * see 05-pricing-tier-fix.md §4.
 */
export const CREDIT_SPEND_CAPS = {
  boost: 1, // 100%
  product_premium: 0.5,
  product_vip: 0.5,
  service_premium: 0.5,
  service_vip: 0.5,
  bundle_premium: 0.5,
  bundle_quarterly: 0.5,
  bundle_yearly: 0.25,
};

/**
 * Get a user's current cached credit balance.
 * Defaults to 0 for users who haven't earned any credit yet (field absent).
 */
export async function getCreditBalance(userId) {
  try {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (!userSnap.exists()) return 0;
    return userSnap.data().creditBalance || 0;
  } catch (error) {
    console.error("Error fetching credit balance:", error);
    throw error;
  }
}

/**
 * Get a page of a user's credit ledger, newest first.
 * Pass the previous call's `lastDoc` to page forward.
 */
export async function getCreditHistory(userId, { pageSize = 20, lastDoc = null } = {}) {
  try {
    const ledgerRef = collection(db, "users", userId, "creditLedger");
    const constraints = [orderBy("createdAt", "desc"), firestoreLimit(pageSize)];
    if (lastDoc) constraints.splice(1, 0, startAfter(lastDoc));

    const snap = await getDocs(query(ledgerRef, ...constraints));
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return {
      entries,
      lastDoc: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (error) {
    console.error("Error fetching credit history:", error);
    throw error;
  }
}
