import { Skeleton } from "@/components/ui/skeleton";

export default function SellerProfileSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-none sm:h-24" />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex flex-col items-center gap-4 sm:-mt-10 sm:flex-row sm:items-end">
          <Skeleton className="h-24 w-24 rounded-full ring-4 ring-white" />
          <div className="w-full flex-1 space-y-2 sm:pb-1">
            <Skeleton className="mx-auto h-6 w-40 sm:mx-0" />
            <Skeleton className="mx-auto h-4 w-56 sm:mx-0" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
