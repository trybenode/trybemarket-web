import { activateSubscription } from "@/lib/subscriptionStore";
import { adminDB } from "@/lib/firebaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { reference, userId, planId } = req.body;

    if (!reference || !userId || !planId) {
      return res.status(400).json({ error: "Missing required fields" });
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

    // Activate subscription with plan object
    const result = await activateSubscription(userId, plan, reference);

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      subscription: result.subscription,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      error: "Failed to verify payment",
      details: error.message,
    });
  }
}
