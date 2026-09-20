import { Skeleton } from "@/components/ui/skeleton";

const ServiceCardSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <Skeleton className="aspect-[4/3] w-full rounded-none" />
    <div className="space-y-2 p-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

export default ServiceCardSkeleton;
