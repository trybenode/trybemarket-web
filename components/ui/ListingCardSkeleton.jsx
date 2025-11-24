import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ListingCardSkeleton() {
  return (
    <Card className="bg-white border border-gray-200 overflow-hidden rounded-lg shadow-sm flex flex-col w-full min-h-[280px]">
      {/* Image Skeleton */}
      <Skeleton className="h-40 w-full rounded-none bg-gray-200" />

      <CardContent className="p-3 flex-grow">
        {/* Product Name Skeleton */}
        <Skeleton className="h-4 w-full mb-2 bg-gray-200" />

        {/* Price Skeleton */}
        <Skeleton className="h-3 w-1/2 mb-2 bg-gray-200" />
        <Skeleton className="h-5 w-3/4 bg-gray-200" />
      </CardContent>

      <CardFooter className="p-3 pt-0">
        {/* Button Skeleton */}
        <Skeleton className="h-9 w-full rounded-md bg-gray-200" />
      </CardFooter>
    </Card>
  )
}
