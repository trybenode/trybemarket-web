import React, { useMemo } from "react";
import Image from "next/image";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceTag, discountPercent } from "@/components/ui/price-tag";

/**
 * A listing in a grid (home, shop, favorites, related items). The whole card is
 * the tap target — parents wrap it in a link or click handler — so the button
 * is a visual cue for the action (`btnName`: "View", "Edit"...), not a second
 * target. A discount pill sits on the photo so a saving is visible at a glance.
 */
function ListingCard({ product = {}, btnName = "View Details", overlay = null }) {
  const imageUri = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]?.url || product.images[0] || null;
    }
    return product.image || null;
  }, [product.images, product.image]);

  const off = discountPercent(product.price, product.originalPrice);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {imageUri ? (
          <Image
            src={imageUri}
            alt={product.name ? `${product.name} image` : "Product image"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}

        {off !== null && (
          <Badge variant="success" className="absolute left-2 top-2 shadow-sm">
            -{off}%
          </Badge>
        )}
        {product.isVip && (
          <Badge variant="yellow" className="absolute right-2 top-2 shadow-sm">
            <Crown className="h-3 w-3" />
            VIP
          </Badge>
        )}
        {/* extra badges from the parent (e.g. "Boosted" in the carousel) */}
        {overlay}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3
          className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
          title={product.name || "Unnamed Product"}
        >
          {product.name || "Unnamed Product"}
        </h3>
        <div className="mt-auto pt-1">
          {product.price != null ? (
            <PriceTag price={product.price} originalPrice={product.originalPrice} size="sm" />
          ) : (
            <p className="text-sm font-semibold text-slate-500">Ask for price</p>
          )}
        </div>
        <Button
          variant="soft"
          size="xs"
          className="w-full"
          aria-label={`${btnName} for ${product.name || "product"}`}
          tabIndex={-1}
        >
          {btnName}
        </Button>
      </div>
    </div>
  );
}

export default React.memo(ListingCard);
