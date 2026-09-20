import AppHeader from "@/components/AppHeader"
import { Skeleton } from "@/components/ui/skeleton"

// Shown while any route is loading, so a navigation never lands on a blank
// white screen. Pages with their own layout show their own skeleton on top.
export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50" aria-busy="true">
      <AppHeader />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Skeleton className="h-11 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
