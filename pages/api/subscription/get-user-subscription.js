import { getUserSubscriptions, getUserLimits } from "@/lib/subscriptionStore";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const subscriptions = await getUserSubscriptions(userId);
    const limits = await getUserLimits(userId);

    return res.status(200).json({
      success: true,
      subscriptions,
      limits,
    });
  } catch (error) {
    console.error("Error fetching user subscription:", error);
    return res.status(500).json({
      error: "Failed to fetch subscription",
      details: error.message,
    });
  }
}
