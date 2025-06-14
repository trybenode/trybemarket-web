import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ServiceCardSkeleton = () => (
  <Card className="bg-white rounded-2xl shadow-md transition-all duration-200 overflow-hidden animate-slow-pulse">
    {/* Image Skeleton */}
    <Skeleton className="h-36 w-full rounded-none" />

    <CardContent className="p-4 flex flex-col gap-2">
      {/* Title Skeleton */}
      <Skeleton className="h-4 w-3/4 rounded" />

      {/* Description Skeleton (two lines for line-clamp-2) */}
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </CardContent>

    <CardFooter className="px-4 pb-4 pt-2 flex justify-between items-center">
      {/* Category Skeleton */}
      <Skeleton className="h-3 w-1/4 rounded" />

      {/* Chevron Icon Skeleton */}
      <Skeleton className="h-5 w-5 rounded-full" />
    </CardFooter>
  </Card>
);

export default ServiceCardSkeleton;