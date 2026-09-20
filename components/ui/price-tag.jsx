import { cn, formatNumber } from "@/lib/utils"

/** Percentage off, or null when there's no real discount. */
export function discountPercent(price, originalPrice) {
  const p = Number(price)
  const o = Number(originalPrice)
  if (!(o > 0) || !(p >= 0) || o <= p) return null
  return Math.round(((o - p) / o) * 100)
}

/**
 * Price with the old price struck through. The discount % is shown by the
 * caller where it fits (a pill on a card image, next to the price on a page),
 * so this component stays a plain, reusable piece of typography.
 */
export function PriceTag({ price, originalPrice, size = "md", className }) {
  const showOriginal = discountPercent(price, originalPrice) !== null
  const sizes = {
    sm: { price: "text-base", old: "text-xs" },
    md: { price: "text-xl", old: "text-sm" },
    lg: { price: "text-3xl", old: "text-base" },
  }[size]

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-extrabold tabular-nums tracking-tight text-slate-900", sizes.price)}>
        ₦{price != null ? formatNumber(price) : "N/A"}
      </span>
      {showOriginal && (
        <span className={cn("tabular-nums text-slate-400 line-through", sizes.old)}>
          ₦{formatNumber(originalPrice)}
        </span>
      )}
    </div>
  )
}
