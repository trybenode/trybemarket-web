import { adminDB } from "@/lib/firebaseAdmin";
import { fulfillPlanPurchase, logFailedSubscriptionPayment } from "@/lib/subscriptionFulfillment";
import { assertPlanEligibilityAdmin, SubscriptionEligibilityError } from "@/lib/subscriptionEligibilityServer";

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
      try {
        await logFailedSubscriptionPayment({ userId, reference, planId, reason: "verification_failed" });
      } catch (logError) {
        console.error("Error logging failed payment:", logError);
      }
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
      try {
        await logFailedSubscriptionPayment({ userId, reference, planId, reason: "amount_mismatch" });
      } catch (logError) {
        console.error("Error logging failed payment:", logError);
      }
      return res.status(400).json({
        error: "Payment amount mismatch",
        expected: plan.price,
        received: paidAmount,
      });
    }

    // Never trust the client's own UI hiding an ineligible plan (e.g.
    // maintenance plans requiring N consecutive paid months) — this is the
    // one path that actually finalizes a purchase for such plans, since
    // they aren't in CREDIT_SPEND_CAPS and can't reach the credit-assisted
    // flow at all. Paystack has already captured payment by this point; an
    // ineligible attempt here only happens if someone bypasses the client
    // gate directly, so declining to grant the plan (while logging the
    // attempt) is the safer outcome even though it doesn't refund on its own.
    try {
      await assertPlanEligibilityAdmin(userId, plan);
    } catch (eligibilityError) {
      if (eligibilityError instanceof SubscriptionEligibilityError) {
        try {
          await logFailedSubscriptionPayment({ userId, reference, planId, reason: "not_eligible" });
        } catch (logError) {
          console.error("Error logging ineligible payment:", logError);
        }
        return res.status(403).json({ error: eligibilityError.message });
      }
      throw eligibilityError;
    }

    // Activate subscription with Firebase Admin SDK to avoid client-rule permission checks.
    const { subscriptionData } = await fulfillPlanPurchase(userId, plan, reference);

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
