"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function SellerProfileSkeleton() {
  return (
    <Card className="mb-8 animate-pulse">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-200" />

          <div className="flex-1 space-y-2 w-full md:w-auto text-center md:text-left">
            <div className="h-6 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>

          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-6 h-6 bg-gray-200 rounded-full" />
            ))}
          </div>

          <div className="hidden md:block">
            <div className="h-10 w-28 bg-gray-200 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
