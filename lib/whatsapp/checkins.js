/**
 * The numbers behind a connected seller's check-ins: live listings, unread
 * chats and shop views. Read-only. `db` is passed in (Admin Firestore).
 *
 *   listings  products + services owned by the seller (held ones live in
 *             heldListings and are reported separately)
 *   messages  `conversation` documents whose unreadBy includes the seller
 *   views     users/{uid}/shopViewLog — one document per viewer per day,
 *             written by /api/shop-view. That route trusts the viewer id it's
 *             sent, so these numbers can be inflated; they're a rough guide.
 */
import { lagosDayKey } from "./usage.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no daylight saving
const MAX_LISTINGS_READ = 300;
const MAX_UNREAD_READ = 50;

/** The instant the Lagos day containing `now` began. */
export function lagosDayStart(now = Date.now()) {
  const key = lagosDayKey(now);
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))) - LAGOS_OFFSET_MS;
}

const toMillis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value instanceof Date ? value.getTime() : Date.parse(value) || 0);

export async function listingSummary(db, uid) {
  const [products, services, held] = await Promise.all([
    db.collection("products").where("userId", "==", uid).select("name", "createdAt").limit(MAX_LISTINGS_READ).get(),
    db.collection("services").where("userId", "==", uid).select("name", "createdAt").limit(MAX_LISTINGS_READ).get(),
    db.collection("heldListings").where("userId", "==", uid).select().limit(MAX_LISTINGS_READ).get(),
  ]);
  const newest = [...products.docs, ...services.docs]
    .map((doc) => doc.data())
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
  return { products: products.size, services: services.size, held: held.size, latest: newest?.name || null };
}

export async function unreadSummary(db, uid) {
  const snap = await db.collection("conversation").where("unreadBy", "array-contains", uid).limit(MAX_UNREAD_READ).get();
  const others = [...new Set(snap.docs.map((doc) => (doc.data().participants || []).find((p) => p !== uid)).filter(Boolean))];
  const named = await Promise.all(
    others.slice(0, 2).map(async (otherUid) => (await db.collection("users").doc(otherUid).get()).data()?.fullName || "")
  );
  return { unread: snap.size, from: named.filter(Boolean) };
}

/** @param {boolean} detailed  also return the last 7 Lagos days (Premium, VIP, Bundle) */
export async function viewsSummary(db, uid, { detailed, now = Date.now() }) {
  const log = db.collection("users").doc(uid).collection("shopViewLog");
  const todayStart = lagosDayStart(now);

  if (!detailed) {
    const today = await log.where("viewedAt", ">=", new Date(todayStart)).count().get();
    return { today: today.data().count, week: null };
  }

  const weekStart = todayStart - 6 * DAY_MS;
  const snap = await log.where("viewedAt", ">=", new Date(weekStart)).select("viewedAt").get();
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = weekStart + i * DAY_MS;
    // Label by the Lagos weekday: noon of that Lagos day, read in UTC+1.
    const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Africa/Lagos" }).format(new Date(start + 12 * 60 * 60 * 1000));
    return { start, label, count: 0 };
  });
  for (const doc of snap.docs) {
    const at = toMillis(doc.data().viewedAt);
    const index = Math.floor((at - weekStart) / DAY_MS);
    if (index >= 0 && index < 7) days[index].count += 1;
  }
  return { today: days[6].count, week: days.map(({ label, count }) => ({ label, count })) };
}
