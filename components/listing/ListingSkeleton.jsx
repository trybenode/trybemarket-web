import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like the listing page, shown while the listing loads. */
export default function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl md:grid md:grid-cols-[1.1fr_1fr] md:gap-8 md:px-4 md:py-6" aria-busy="true">
      <div>
        <Skeleton className="aspect-square w-full rounded-none rounded-b-3xl md:rounded-2xl" />
      </div>
      <div className="space-y-4 px-4 pt-5 md:px-0 md:pt-0">
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-9 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
