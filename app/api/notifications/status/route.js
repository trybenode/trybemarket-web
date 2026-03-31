import { getNotificationStatus } from "@/lib/notifications";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const status = await getNotificationStatus(userId);
    
    return Response.json(status);
  } catch (error) {
    console.error("Notification status route error:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
