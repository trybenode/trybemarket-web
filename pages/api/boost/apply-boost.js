import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    let uid;
    try {
      ({ uid } = await adminAuth.verifyIdToken(idToken));
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const { itemId, itemType, creditId } = req.body;

    if (!itemId || !["product", "service"].includes(itemType)) {
      return res.status(400).json({ error: "Missing or invalid itemId/itemType" });
    }

    const collectionName = itemType === "product" ? "products" : "services";
    const itemRef = adminDB.collection(collectionName).doc(itemId);

    const creditsRef = adminDB.collection("boostCredits");

    let creditSnap;
    if (creditId) {
      const snap = await creditsRef.doc(creditId).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Boost credit not found" });
      }
      creditSnap = snap;
    } else {
      // Equality-only filters so this doesn't need a composite index; the
      // oldest credit is picked in memory since a seller rarely holds more
      // than a couple of unused credits at once.
      const query = await creditsRef
        .where("userId", "==", uid)
        .where("status", "==", "unused")
        .get();

      if (query.empty) {
        return res.status(402).json({
          error: "No boost credit available. Purchase a boost plan first.",
        });
      }
      creditSnap = query.docs.sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis?.() ?? 0;
        const bTime = b.data().createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      })[0];
    }

    const credit = creditSnap.data();

    if (credit.userId !== uid) {
      return res.status(403).json({ error: "This boost credit does not belong to you" });
    }

    if (credit.status !== "unused") {
      return res.status(409).json({ error: "This boost credit has already been used" });
    }

    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    const item = itemSnap.data();
    if (item.userId !== uid && item.sellerId !== uid) {
      return res.status(403).json({ error: "You do not own this item" });
    }

    const now = new Date();
    const currentBoostEnd = item.boostEndDate?.toDate ? item.boostEndDate.toDate() : null;
    if (item.isBoosted && currentBoostEnd && currentBoostEnd > now) {
      return res.status(409).json({ error: "This item is already boosted" });
    }

    const durationDays = Number(credit.durationDays) > 0 ? Number(credit.durationDays) : 7;
    const boostEndDate = new Date(now);
    boostEndDate.setDate(boostEndDate.getDate() + durationDays);

    const batch = adminDB.batch();
    batch.update(itemRef, {
      isBoosted: true,
      boostStartDate: now,
      boostEndDate,
      boostPlanId: credit.planId || null,
      boostTier: credit.tier || null,
      updatedAt: now,
    });
    batch.update(creditSnap.ref, {
      status: "used",
      usedAt: now,
      itemId,
      itemType,
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      boostEndDate: boostEndDate.toISOString(),
    });
  } catch (error) {
    console.error("Error applying boost:", error);
    return res.status(500).json({
      error: "Failed to apply boost",
      details: error.message,
    });
  }
}
