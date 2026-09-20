import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one button. Every action in the app should be one of these variants so
 * the app reads as a single product:
 *   default  primary action (brand blue)         soft     secondary action, tinted
 *   outline  neutral bordered                    ghost    low-emphasis / toolbar
 *   accent   the logo's yellow, for highlights   dark     high-contrast alternative
 *   destructive                                  link
 * Two things every button now gets for free:
 *   - press feedback (a slight shrink), so taps feel acknowledged in the
 *     installed app where there's no browser chrome to react;
 *   - `loading`: shows a spinner, disables the button and sets aria-busy, so
 *     async actions always show that something is happening.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        soft: "bg-primary/10 text-primary hover:bg-primary/15",
        accent: "bg-brand-yellow text-slate-900 shadow-sm hover:bg-brand-yellow-deep",
        dark: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        xs: "h-8 rounded-lg px-2.5 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}, ref) => {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
