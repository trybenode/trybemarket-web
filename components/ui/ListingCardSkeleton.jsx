import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ListingCardSkeleton() {
  return (
    // <Card className="overflow-hidden rounded-xl shadow-md h-full flex flex-col">
    <Card className="overflow-hidden rounded-xl shadow-md flex flex-col w-full min-h-[280px]">

      {/* Image Skeleton */}
      <Skeleton className="h-40 w-full rounded-none" />

      <CardContent className="p-4 flex-grow">
        {/* Product Name Skeleton */}
        <Skeleton className="h-5 w-full mb-2" />

        {/* Price Skeleton */}
        <Skeleton className="h-4 w-1/2 mb-1" />
        <Skeleton className="h-5 w-3/4" />
      </CardContent>

      <CardFooter className="p-2 pt-0">
        {/* Button Skeleton */}
        <Skeleton className="h-9 w-full rounded-full" />
      </CardFooter>
    </Card>
  )
}
