import * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  outline: "border-slate-200 text-slate-700",
  success: "border-transparent bg-emerald-100 text-emerald-800",
  brand: "border-transparent bg-blue-50 text-blue-700",
  warning: "border-transparent bg-amber-100 text-amber-800",
  yellow: "border-transparent bg-brand-yellow text-slate-900",
  muted: "border-transparent bg-slate-100 text-slate-700",
}

function Badge({ className, variant = "default", ...props }) {
  const variantClass = badgeVariants[variant] || badgeVariants.default

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClass,
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
