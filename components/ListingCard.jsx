import React, { useMemo } from "react"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"

function ListingCard({ product = {}, btnName = "View Details" }) {
  // Memoize imageUri to avoid recalculations
  const imageUri = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]?.url || product.images[0] || null
    }
    return product.image || null
  }, [product.images, product.image])

  // Price formatting helper
  const displayOriginalPrice = product.originalPrice != null
  const displayPrice = product.price != null ? formatNumber(product.price) : "N/A"

  return (
    <Card className="bg-gray-300 overflow-hidden rounded-xl shadow-md h-full flex flex-col">
      {imageUri ? (
        <div className="relative h-40 w-full">
          <Image
            src={imageUri}
            alt={product.name ? `${product.name} image` : "Product image"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false} 
            placeholder="blur"
            blurDataURL="/placeholder.svg"
          />
        </div>
      ) : (
        <div className="h-40 w-full flex items-center justify-center bg-gray-200">
          <p className="text-lg text-gray-500">No Image</p>
        </div>
      )}

      <CardContent className="p-4 flex-grow">
        <h3 className="text-base font-semibold truncate" title={product.name || "Unnamed Product"}>
          {product.name || "Unnamed Product"}
        </h3>

        {displayOriginalPrice && (
          <p className="mt-1 text-sm font-bold line-through text-blue-600">
            ₦{formatNumber(product.originalPrice)}
          </p>
        )}

        <p className="text-base text-blue-900">₦{displayPrice}</p>
      </CardContent>

      <CardFooter className="p-2 pt-0">
        <Button
          className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white"
          variant="default"
          aria-label={`${btnName} for ${product.name || "product"}`}
        >
          {btnName}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default React.memo(ListingCard)
