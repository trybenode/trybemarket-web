import { adminDB } from "@/lib/firebaseAdmin";
import { checkPlanEligibility } from "@/lib/subscriptionStore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, planId, email } = req.body;

    // Validate required fields
    if (!userId || !planId || !email) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: userId, planId, email" 
      });
    }

    // Get plan from database
    const planDoc = await adminDB.collection("subscriptionPlans").doc(planId).get();
    
    if (!planDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: "Plan not found",
        message: "The specified plan does not exist"
      });
    }

    const plan = { id: planDoc.id, ...planDoc.data() };

    // Check if plan requires eligibility (maintenance plans)
    if (plan.eligibility?.requiresPaidMonths > 0) {
      const eligibilityCheck = await checkPlanEligibility(userId, planId);
      
      if (!eligibilityCheck.eligible) {
        return res.status(403).json({
          success: false,
          error: "Not eligible for this plan",
          message: eligibilityCheck.reason || "This plan requires 3 paid months history"
        });
      }
    }

    // Generate unique reference
    const reference = `${userId}-${Date.now()}`;

    // Get Paystack secret key
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ 
        success: false,
        error: "Payment gateway not configured" 
      });
    }

    // Calculate amount in kobo (Paystack uses kobo)
    const amountInKobo = plan.price * 100;

    // Initialize transaction with Paystack
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          amount: amountInKobo,
          reference: reference,
          currency: "NGN",
          callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://trybemarket.online'}/payment/callback`,
          metadata: {
            userId: userId,
            planId: plan.id,
            planName: plan.name,
            category: plan.category,
            type: plan.type,
            custom_fields: [
              {
                display_name: "User ID",
                variable_name: "user_id",
                value: userId,
              },
              {
                display_name: "Plan Name",
                variable_name: "plan_name",
                value: plan.name,
              },
            ],
          },
        }),
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack initialization failed:", paystackData);
      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        message: paystackData.message || "Could not initialize Paystack transaction",
      });
    }

    // Store pending payment record in Firestore
    try {
      await adminDB.collection("subscriptionPayments").doc(reference).set({
        userId: userId,
        planId: plan.id,
        category: plan.category,
        amount: plan.price,
        reference: reference,
        status: "pending",
        createdAt: new Date().toISOString(),
        metadata: {
          planName: plan.name,
          type: plan.type,
          category: plan.category,
        },
      });
    } catch (firestoreError) {
      console.error("Error storing payment record:", firestoreError);
      // Continue anyway - payment can still work
    }

    // Return payment details for mobile app
    return res.status(200).json({
      success: true,
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      },
      message: "Payment initialized successfully",
    });

  } catch (error) {
    console.error("Error initializing payment:", error);
    return res.status(500).json({
      success: false,
      error: "Payment initialization failed",
      message: error.message,
    });
  }
}
