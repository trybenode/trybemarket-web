import React, { useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Crown } from "lucide-react";

function ListingCard({ product = {}, btnName = "View Details" }) {
  // Memoize imageUri to avoid recalculations
  const imageUri = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]?.url || product.images[0] || null;
    }
    return product.image || null;
  }, [product.images, product.image]);

  // Price formatting helper
  const displayOriginalPrice = product.originalPrice != null;
  const displayPrice =
    product.price != null ? formatNumber(product.price) : "N/A";

  return (
    <Card className="bg-white border border-gray-200 overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow h-full flex flex-col group">
      <div className="relative h-40 w-full bg-gray-100">
        {imageUri ? (
          <Image
            src={imageUri}
            alt={product.name ? `${product.name} image` : "Product image"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="/placeholder.svg"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-sm text-gray-400">No Image</p>
          </div>
        )}
        
        {/* VIP Badge */}
        {product.isVip && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 shadow-md flex items-center gap-1 px-2 py-1">
              <Crown className="h-3 w-3" />
              <span className="text-xs font-bold">VIP</span>
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-3 flex-grow">
        <h3
          className="text-sm font-semibold text-gray-900 truncate mb-1"
          title={product.name || "Unnamed Product"}
        >
          {product.name || "Unnamed Product"}
        </h3>

        {displayOriginalPrice && product.originalPrice && (
          <p className="text-xs line-through text-gray-400">
            ₦{formatNumber(product.originalPrice)}
          </p>
        )}

        <p className="text-base font-bold text-gray-900">₦{displayPrice}</p>
      </CardContent>

      <CardFooter className="p-3 pt-0">
        <Button
          className="w-full rounded-md text-white text-sm h-9"
          style={{ backgroundColor: 'rgb(37,99,235)' }}
          variant="default"
          aria-label={`${btnName} for ${product.name || "product"}`}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
        >
          {btnName}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default React.memo(ListingCard);
