"use client"

import { useState, useEffect } from "react"
import { Bell, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

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
        const response = await fetch(`/api/notifications/status?userId=${userId}`)
        const data = await response.json()
        setStatus(data.emailSent || { count: 0, remaining: 0, limit: 0 })
      } catch (error) {
        console.error("Error fetching notification status:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()

    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [userId])

  if (loading || !userId) return null

  const percentage = status.limit > 0 ? Math.max(0, Math.min(100, (status.remaining / status.limit) * 100)) : 0
  const isLow = percentage < 30 && percentage > 0
  const isEmpty = status.remaining === 0

  // Color variants
  const containerClass = isEmpty
    ? "bg-red-50/95 border-red-200 hover:border-red-300"
    : isLow
    ? "bg-amber-50/95 border-amber-200 hover:border-amber-300"
    : "bg-blue-50/95 border-blue-200 hover:border-blue-300"

  const iconClass = isEmpty
    ? "text-red-600"
    : isLow
    ? "text-amber-600"
    : "text-blue-600"

  const textClass = isEmpty
    ? "text-red-700"
    : isLow
    ? "text-amber-700"
    : "text-blue-700"

  const barClass = isEmpty
    ? "bg-red-600"
    : isLow
    ? "bg-amber-600"
    : "bg-blue-600"

  return (
    <div
      title={`Daily email notifications • ${status.remaining} of ${status.limit} remaining today`}
      className={`group flex-shrink-0 rounded-2xl border p-2 sm:p-2.5 shadow-sm backdrop-blur-md transition-all hover:shadow-md ${containerClass}`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Icon */}
        <Bell className={`h-4 w-4 shrink-0 transition-colors ${iconClass}`} />

        {/* Quota display */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-px">
            <span
              className={`tabular-nums text-base font-semibold tracking-tighter transition-colors ${textClass}`}
            >
              {status.remaining}
            </span>
            <span className="text-xs font-medium text-gray-400">/{status.limit}</span>
          </div>

          {/* Subtitle - hidden on mobile, visible on sm+ */}
          <span className="hidden text-[10px] font-medium text-gray-500 sm:block">
            emails left today
          </span>
        </div>

        {/* Upgrade CTA - icon-only on mobile, full button on sm+ */}
        {(isEmpty || isLow) && (
          <button
            onClick={() => router.push("/subscription")}
            className={`ml-auto flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition-all active:scale-95 ${
              isEmpty
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            <Zap className="h-3 w-3" />
            {/* Text hidden on mobile */}
            <span className="hidden sm:inline">
              {isEmpty ? "Upgrade" : "Premium"}
            </span>
          </button>
        )}
      </div>

      {/* Progress bar - always visible, ultra-thin */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}