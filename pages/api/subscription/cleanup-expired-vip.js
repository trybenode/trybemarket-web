import { adminDB } from "@/lib/firebaseAdmin";

/**
 * Converts any Firestore Timestamp format or ISO string to a JavaScript Date.
 * Handles: Timestamp instance, plain { _seconds }, plain { seconds }, ISO string.
 */
function parseExpiryDate(expiryDate) {
  if (!expiryDate) return null;
  if (typeof expiryDate?.toDate === "function") return expiryDate.toDate();
  if (typeof expiryDate?.toMillis === "function") return new Date(expiryDate.toMillis());
  if (expiryDate?._seconds !== undefined) return new Date(expiryDate._seconds * 1000);
  if (expiryDate?.seconds !== undefined) return new Date(expiryDate.seconds * 1000);
  return new Date(expiryDate);
}

/**
 * Returns true only if the subscription is currently marked active but its
 * expiryDate has already passed — i.e. it needs to be cleaned up.
 */
function isExpiredAndStillActive(subscription) {
  if (!subscription?.isActive) return false; // already marked inactive — skip
  if (!subscription?.expiryDate) return false;
  const expiry = parseExpiryDate(subscription.expiryDate);
  if (!expiry || isNaN(expiry.getTime())) return false;
  return expiry < new Date();
}

/**
 * Writes isVip: false to documents in chunks of 400 (safely under Firestore's
 * 500-writes-per-batch limit).
 */
async function stripVipInBatches(docs) {
  const BATCH_SIZE = 400;
  let stripped = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = adminDB.batch();
    chunk.forEach((doc) => batch.update(doc.ref, { isVip: false }));
    await batch.commit();
    stripped += chunk.length;
  }
  return stripped;
}

/**
 * Fetches all VIP items from a collection whose userId is in the given list.
 * Firestore 'in' operator supports max 30 values, so we chunk.
 */
async function getVipItemsByUserIds(collectionName, userIds) {
  const CHUNK_SIZE = 30;
  const docs = [];
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const snap = await adminDB
      .collection(collectionName)
      .where("userId", "in", chunk)
      .where("isVip", "==", true)
      .get();
    docs.push(...snap.docs);
  }
  return docs;
}

/**
 * POST /api/subscription/cleanup-expired-vip
 * GET  /api/subscription/cleanup-expired-vip  (for Vercel cron)
 *
 * Scans all subscription documents, finds expired-but-still-active plans,
 * strips isVip from their products/services, and marks the plan as inactive.
 *
 * Protected by Authorization: Bearer <CRON_SECRET>
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const subsSnapshot = await adminDB.collection("subscriptions").get();

    // Separate which users have expired product vs service plans.
    // A bundle expiry means both categories are expired.
    const expiredProductUserIds = new Set();
    const expiredServiceUserIds = new Set();
    const subMarkInactive = []; // { ref, fields }

    for (const subDoc of subsSnapshot.docs) {
      const data = subDoc.data();
      const userId = subDoc.id;

      const bundleExpired = data.bundle && isExpiredAndStillActive(data.bundle);
      const productExpired = bundleExpired || (data.product && isExpiredAndStillActive(data.product));
      const serviceExpired = bundleExpired || (data.service && isExpiredAndStillActive(data.service));

      if (!productExpired && !serviceExpired && !bundleExpired) continue;

      if (productExpired) expiredProductUserIds.add(userId);
      if (serviceExpired) expiredServiceUserIds.add(userId);

      // Collect which fields to mark inactive
      const fields = {};
      if (bundleExpired) fields["bundle.isActive"] = false;
      if (productExpired) fields["product.isActive"] = false;
      if (serviceExpired) fields["service.isActive"] = false;

      subMarkInactive.push({ ref: subDoc.ref, fields });
    }

    // Strip VIP from products and services
    const [vipProducts, vipServices] = await Promise.all([
      expiredProductUserIds.size > 0
        ? getVipItemsByUserIds("products", [...expiredProductUserIds])
        : Promise.resolve([]),
      expiredServiceUserIds.size > 0
        ? getVipItemsByUserIds("services", [...expiredServiceUserIds])
        : Promise.resolve([]),
    ]);

    const [productsStripped, servicesStripped] = await Promise.all([
      stripVipInBatches(vipProducts),
      stripVipInBatches(vipServices),
    ]);

    // Mark expired subscriptions as inactive (prevents double-processing on next run)
    if (subMarkInactive.length > 0) {
      const BATCH_SIZE = 400;
      for (let i = 0; i < subMarkInactive.length; i += BATCH_SIZE) {
        const chunk = subMarkInactive.slice(i, i + BATCH_SIZE);
        const batch = adminDB.batch();
        chunk.forEach(({ ref, fields }) => batch.update(ref, fields));
        await batch.commit();
      }
    }

    const result = {
      success: true,
      expiredUsers: {
        product: expiredProductUserIds.size,
        service: expiredServiceUserIds.size,
      },
      vipStripped: {
        products: productsStripped,
        services: servicesStripped,
      },
      subscriptionsMarkedInactive: subMarkInactive.length,
      runAt: new Date().toISOString(),
    };

    console.log("VIP cleanup complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("VIP cleanup error:", error);
    return res.status(500).json({ error: "Cleanup failed", details: error.message });
  }
}
