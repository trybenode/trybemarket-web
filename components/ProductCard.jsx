"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

export default function ProductCard({ product }) {
  const router = useRouter();

  // Handle card click to navigate to product details
  const handleClick = () => {
    router.push(`/listing/${product.id}`);
  };

  return (
    <Card
      className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="w-full h-32 bg-gray-100 rounded mb-4 flex items-center justify-center">
        {product.images && product.images[0] ? (
          <img
            src={product.images[0].url || product.images[0]}
            alt={product.name}
            className="object-contain h-full w-full rounded"
          />
        ) : (
          <span className="text-gray-400">No Image</span>
        )}
      </div>
      <div className="w-full text-center">
        <h3 className="font-semibold text-lg text-gray-900 mb-1">
          {product.name}
        </h3>
        <p className="text-gray-600 text-sm mb-2">
          {product.categoryId || "Product"}
        </p>
        <p className="text-green-600 font-bold text-lg">
          ₦{product.price?.toLocaleString() || 0}
        </p>
      </div>
    </Card>
  );
}
