import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkShopViewNotificationQuota, incrementShopViewNotified } from "@/lib/notifications";
import { sendShopViewWhatsAppNotification } from "@/lib/whatsapp";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // matches hooks/useLastSeen.js
const NOTIFY_DEBOUNCE_MS = 5 * 60 * 1000; // matches message-notification debounce

const PREMIUM_PLAN_IDS = ["product_premium", "product_vip", "service_premium", "service_vip"];

function isRecentlyActive(lastSeen) {
  if (!lastSeen?.toDate) return false;
  return Date.now() - lastSeen.toDate().getTime() < ONLINE_THRESHOLD_MS;
}

async function isPremiumOrVipSeller(sellerId) {
  const subSnap = await adminDB.collection("subscriptions").doc(sellerId).get();
  if (!subSnap.exists) return false;

  const data = subSnap.data();
  const isActive = (sub) => sub?.isActive && (!sub?.expiryDate || sub.expiryDate.toDate?.() > new Date());

  if (isActive(data.bundle)) return true;
  if (isActive(data.product) && PREMIUM_PLAN_IDS.includes(data.product.planId)) return true;
  if (isActive(data.service) && PREMIUM_PLAN_IDS.includes(data.service.planId)) return true;
  return false;
}

export async function POST(req) {
  try {
    const { sellerId, viewerId, sessionId } = await req.json();

    if (!sellerId) {
      return Response.json({ error: "Missing sellerId" }, { status: 400 });
    }

    // Never count a seller viewing their own shop
    if (viewerId && viewerId === sellerId) {
      return Response.json({ counted: false, notified: false, reason: "self-view" });
    }

    const dedupeKey = viewerId ? `uid_${viewerId}` : sessionId ? `anon_${sessionId}` : null;
    if (!dedupeKey) {
      return Response.json({ counted: false, notified: false, reason: "no-viewer-identity" });
    }

    const today = new Date().toISOString().split("T")[0];
    const sellerRef = adminDB.collection("users").doc(sellerId);
    const logRef = sellerRef.collection("shopViewLog").doc(`${dedupeKey}_${today}`);

    const logSnap = await logRef.get();
    if (logSnap.exists) {
      return Response.json({ counted: false, notified: false, reason: "already-viewed-today" });
    }

    await logRef.set({ viewerKey: dedupeKey, viewedAt: FieldValue.serverTimestamp() });
    await sellerRef.update({ shopViewCount: FieldValue.increment(1) });

    // Notification is a premium/VIP-only perk; count still applies to all tiers above.
    if (!(await isPremiumOrVipSeller(sellerId))) {
      return Response.json({ counted: true, notified: false, reason: "free-tier" });
    }

    const sellerSnap = await sellerRef.get();
    const seller = sellerSnap.data() || {};

    if (isRecentlyActive(seller.lastSeen)) {
      return Response.json({ counted: true, notified: false, reason: "owner-online" });
    }

    const lastShopViewNotifiedAt = seller.lastShopViewNotifiedAt?.toMillis?.() || 0;
    if (Date.now() - lastShopViewNotifiedAt < NOTIFY_DEBOUNCE_MS) {
      return Response.json({ counted: true, notified: false, reason: "recently-notified" });
    }

    if (!seller.whatsappNotifications || !seller.phone) {
      return Response.json({ counted: true, notified: false, reason: "not-opted-in" });
    }

    const quota = await checkShopViewNotificationQuota(sellerId);
    if (!quota.allowed) {
      return Response.json({ counted: true, notified: false, reason: "quota-reached" });
    }

    const sent = await sendShopViewWhatsAppNotification({
      recipientPhone: seller.phone,
      recipientName: seller.fullName || "there",
      sellerId,
    });

    if (!sent) {
      return Response.json({ counted: true, notified: false, reason: "send-failed-or-not-configured" });
    }

    await incrementShopViewNotified(sellerId);
    await sellerRef.update({ lastShopViewNotifiedAt: FieldValue.serverTimestamp() });

    return Response.json({ counted: true, notified: true });
  } catch (error) {
    console.error("Error recording shop view:", error);
    return Response.json({ error: "Failed to record shop view" }, { status: 500 });
  }
}
