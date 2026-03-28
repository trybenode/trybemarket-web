"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Zap, X, TrendingUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const PLAN_BENEFITS = {
  product_free: {
    name: "Free Plan",
    notifications: 5,
    color: "bg-gray-100 text-gray-700",
  },
  product_premium: {
    name: "Premium Plan",
    notifications: 10,
    color: "bg-blue-100 text-blue-700",
  },
  product_vip: {
    name: "VIP Plan",
    notifications: 20,
    color: "bg-purple-100 text-purple-700",
  },
}

export default function UpgradePrompt({ open, onClose, currentPlan = "product_free" }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(open)

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  const handleUpgrade = () => {
    handleClose()
    router.push("/subscription")
  }

  const currentPlanInfo = PLAN_BENEFITS[currentPlan] || PLAN_BENEFITS.product_free
  const suggestedPlan = currentPlan === "product_free" ? PLAN_BENEFITS.product_premium : PLAN_BENEFITS.product_vip

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Daily Notification Limit Reached
            </DialogTitle>
          </div>
          <DialogDescription>
            You've used all {currentPlanInfo.notifications} notifications for today on your {currentPlanInfo.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Plan */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Your Current Plan</span>
              <Badge className={currentPlanInfo.color}>{currentPlanInfo.name}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-2xl font-bold text-gray-900">
                {currentPlanInfo.notifications}
              </span>
              <span>notifications per day</span>
            </div>
          </div>

          {/* Upgrade Option */}
          {currentPlan !== "product_vip" && (
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Upgrade to {suggestedPlan.name}</span>
                <Badge className={suggestedPlan.color}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Recommended
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <span className="text-2xl font-bold text-blue-600">
                  {suggestedPlan.notifications}
                </span>
                <span>notifications per day</span>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>
                    {suggestedPlan.notifications - currentPlanInfo.notifications}x more daily notifications
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>Priority customer support</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span>Access to premium features</span>
                </li>
              </ul>
            </div>
          )}

          {/* Info Message */}
          <p className="text-sm text-gray-500 text-center">
            Your notification limit will reset tomorrow at midnight
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {currentPlan !== "product_vip" && (
            <Button onClick={handleUpgrade} className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} className={currentPlan !== "product_vip" ? "" : "flex-1"}>
            {currentPlan === "product_vip" ? "Close" : "Maybe Later"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
