import { checkPlanEligibility } from "@/lib/subscriptionStore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, planId } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const eligibility = await checkPlanEligibility(userId, planId);

    return res.status(200).json({
      success: true,
      ...eligibility,
    });
  } catch (error) {
    console.error("Error checking eligibility:", error);
    return res.status(500).json({
      error: "Failed to check eligibility",
      details: error.message,
    });
  }
}
