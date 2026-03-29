"use client"

import { useState, useEffect } from "react"
import { Bell, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

/**
 * Shows user's remaining daily email notifications (what they can send)
 */
export default function NotificationCounter({ userId }) {
  const [status, setStatus] = useState({ count: 0, remaining: 0, limit: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        console.log("=== NotificationCounter fetching status for userId:", userId);
        const response = await fetch(`/api/notifications/status?userId=${userId}`);
        const data = await response.json();
        console.log("NotificationCounter received status:", data);
        // Extract email sent stats (what user controls)
        setStatus(data.emailSent || { count: 0, remaining: 0, limit: 0 })
      } catch (error) {
        console.error("Error fetching notification status:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    
    // Refresh every minute
    const interval = setInterval(() => {
      console.log("NotificationCounter: 60-second refresh triggered");
      fetchStatus();
    }, 60000)
    return () => clearInterval(interval)
  }, [userId])

  if (loading || !userId) return null

  const percentage = status.limit > 0 ? (status.remaining / status.limit) * 100 : 0
  const isLow = percentage < 30 && percentage > 0
  const isEmpty = status.remaining === 0

  return (
    <div className="fixed top-6 right-4 z-50">
      <div
        className={`rounded-lg shadow-lg border p-3 backdrop-blur-sm transition-all ${
          isEmpty
            ? "bg-red-50/90 border-red-200"
            : isLow
            ? "bg-yellow-50/90 border-yellow-200"
            : "bg-blue-50/90 border-blue-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <Bell
            className={`h-5 w-5 ${
              isEmpty ? "text-red-600" : isLow ? "text-yellow-600" : "text-blue-600"
            }`}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  isEmpty ? "text-red-700" : isLow ? "text-yellow-700" : "text-blue-700"
                }`}
              >
                {status.remaining}
              </span>
              <span className="text-xs text-gray-600">
                of {status.limit} emails left today
              </span>
            </div>

            {isEmpty && (
              <button
                onClick={() => router.push("/subscription")}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 transition-colors"
              >
                <Zap className="h-3 w-3" />
                Upgrade to send more
              </button>
            )}

            {isLow && !isEmpty && (
              <button
                onClick={() => router.push("/subscription")}
                className="mt-1 text-xs text-yellow-700 hover:text-yellow-800 transition-colors"
              >
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              isEmpty ? "bg-red-600" : isLow ? "bg-yellow-600" : "bg-blue-600"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
