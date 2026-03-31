import { adminDB } from "@/lib/firebaseAdmin";

function calculateExpiryDate(cycle = "monthly", durationMonths = 1) {
  const date = new Date();

  if (cycle === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else if (cycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else if (cycle === "one-time") {
    const durationDays = Number(durationMonths) * 30;
    date.setDate(date.getDate() + (Number.isFinite(durationDays) ? durationDays : 30));
  } else if (durationMonths) {
    date.setMonth(date.getMonth() + Number(durationMonths));
  }

  return date.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { reference, userId, planId } = req.body;

    if (!reference || !userId || !planId) {
      return res.status(400).json({ error: "Missing required fields: reference, userId, and planId" });
    }

    // Verify payment with Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ error: "Payment gateway not configured" });
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return res.status(400).json({
        error: "Payment verification failed",
        details: verifyData.message,
      });
    }

    // Get plan from database
    const planDoc = await adminDB.collection("subscriptionPlans").doc(planId).get();
    
    if (!planDoc.exists) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const plan = { id: planDoc.id, ...planDoc.data() };

    const paidAmount = verifyData.data.amount / 100; // Paystack returns amount in kobo
    if (paidAmount !== plan.price) {
      return res.status(400).json({
        error: "Payment amount mismatch",
        expected: plan.price,
        received: paidAmount,
      });
    }

    // Activate subscription with Firebase Admin SDK to avoid client-rule permission checks.
    const now = new Date().toISOString();
    const expiryDate = calculateExpiryDate(plan.cycle, plan.durationMonths || 1);
    const subscriptionData = {
      planId: plan.id,
      planName: plan.name,
      category: plan.category,
      amount: plan.price,
      isActive: true,
      subscribedAt: now,
      expiryDate,
      features: plan.features || [],
      limits: plan.limits || {},
      paymentReference: reference,
      autoRenew: false,
    };

    const subscriptionUpdate =
      plan.category === "bundle"
        ? { bundle: subscriptionData }
        : { [plan.category]: subscriptionData };

    await adminDB.collection("subscriptions").doc(userId).set(subscriptionUpdate, { merge: true });

    await adminDB.collection("users").doc(userId).set(
      {
        notifications: {
          emailSent: {
            dailyCount: 0,
            lastResetDate: now.split("T")[0],
          },
          whatsappReceived: {
            dailyCount: 0,
            lastResetDate: now.split("T")[0],
          },
        },
      },
      { merge: true }
    );

    await adminDB.collection("subscriptionPayments").doc(reference).set(
      {
        userId,
        planId: plan.id,
        category: plan.category,
        amount: plan.price,
        reference,
        status: "success",
        verifiedAt: now,
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      subscription: subscriptionData,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      error: "Failed to verify payment",
      details: error.message,
    });
  }
}
