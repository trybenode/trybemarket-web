import { cn } from "@/lib/utils"

/** Loading placeholder. Pulses gently; reduced-motion users get a static block. */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
