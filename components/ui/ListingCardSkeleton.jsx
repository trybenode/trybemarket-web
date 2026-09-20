import { Skeleton } from "@/components/ui/skeleton";

export default function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2.5 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-7 w-full rounded-lg" />
      </div>
    </div>
  );
}
