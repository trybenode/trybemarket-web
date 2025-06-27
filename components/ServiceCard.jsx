"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function ServiceCard({ service }) {
  const router = useRouter();

  // Handle card click to navigate to service details
  const handleClick = () => {
    router.push(`/view-service/${service.id}`);
  };

  return (
    <Card
      className='bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer border border-gray-100 hover:border-gray-200'
      onClick={handleClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <CardContent className='p-0'>
        {/* Image Section */}
        <div className='w-full h-40 bg-gray-100 flex items-center justify-center overflow-hidden'>
          {service.images && service.images[0] ? (
            <img
              src={service.images[0]}
              alt={service.name}
              className='object-cover h-32 w-full transition-transform duration-300 hover:scale-105'
            />
          ) : (
            <span className='text-gray-400 text-sm font-medium'>No Image</span>
          )}
        </div>

        {/* Content Section */}
        <div className='p-4'>
          <h3 className='font-semibold text-gray-900 mb-2 line-clamp-1'>
            {service.name}
          </h3>
          <p className='text-gray-600 text-sm mb-2 line-clamp-2 min-h-[40px]'>
            {service.description || "No description available"}
          </p>
          <p className='text-gray-500 text-sm mb-2'>
            {service.categoryId || "Service"}
          </p>
          {/* <p className='text-green-600 font-bold text-lg'>
            ₦{service.price?.toLocaleString() || 0}
          </p> */}
        </div>
      </CardContent>
    </Card>
  );
}
