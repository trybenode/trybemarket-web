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

  const isEmpty = status.remaining === 0
  const isLow = status.limit > 0 && status.remaining / status.limit < 0.3 && !isEmpty
  const needsUpgrade = isEmpty || isLow

  const tone = isEmpty
    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : isLow
    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
    : "border-slate-200 bg-slate-50 text-slate-700"

  const label = `Daily email notifications: ${status.remaining} of ${status.limit} left today`
  const content = (
    <>
      <Bell className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums text-sm font-bold">{status.remaining}</span>
      <span className="text-xs font-medium opacity-60">/{status.limit}</span>
      <span className="hidden text-xs font-medium sm:inline">{needsUpgrade ? (isEmpty ? "Upgrade" : "Running low") : "emails left"}</span>
    </>
  )

  // Compact pill; when the quota is low or gone the whole pill takes you to the plans.
  return needsUpgrade ? (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => router.push("/subscription")}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 transition active:scale-95 ${tone}`}
    >
      {content}
      <Zap className="h-3 w-3" />
    </button>
  ) : (
    <div title={label} aria-label={label} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${tone}`}>
      {content}
    </div>
  )
}
