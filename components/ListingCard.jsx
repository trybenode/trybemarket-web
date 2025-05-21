import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"


export default function ListingCard({ product = {}, btnName = "View Details" }) {
  const imageUri =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]?.url || product.images[0]
      : product.image || null

  return (
    <Card className="overflow-hidden rounded-xl shadow-md h-full flex flex-col">
      {/* Product Image */}
      {imageUri ? (
        <div className="relative h-40 w-full">
          <Image
            src={imageUri || "/placeholder.svg"}
            alt={product?.name || "Product image"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="h-40 w-full flex items-center justify-center bg-gray-200">
          <p className="text-lg text-gray-500">No Image</p>
        </div>
      )}

      <CardContent className="p-4 flex-grow">
        {/* Product Name */}
        <h3 className="text-base font-semibold truncate">{product?.name || "Unnamed Product"}</h3>

        {/* Original Price */}
        {product.originalPrice ? (
          <p className="mt-1 text-sm font-bold line-through text-blue-600">
            ₦{formatNumber(product.originalPrice.toLocaleString())}
          </p>
        ) : null}

        {/* Discounted Price */}
        <p className="text-base text-blue-900">₦{formatNumber(product?.price?.toLocaleString()) || "N/A"}</p>
      </CardContent>

      {/* Action Button */}
      <CardFooter className="p-2 pt-0">
        <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white" variant="default">
          {btnName}
        </Button>
      </CardFooter>
    </Card>
  )
}
