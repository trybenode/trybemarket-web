"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

/**
 * A service in a grid (explore, shop, favorites). Matches ListingCard so the
 * two read as one family; services have no price, so the description leads.
 */
export default function ServiceCard({ service }) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/view-service/${service.id}`);
  };

  const image = service.images?.[0]?.url || service.images?.[0] || null;

  return (
    <div
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {image ? (
          <Image
            src={image}
            alt={service.name || "Service"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">No image</div>
        )}
        <Badge variant="brand" className="absolute left-2 top-2 shadow-sm">
          {service.categoryId || "Service"}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{service.name}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
          {service.description || "No description available"}
        </p>
      </div>
    </div>
  );
}
