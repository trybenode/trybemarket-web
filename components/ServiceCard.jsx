"use client";

import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const ServiceCard = ({ id, categoryId, name, description, images }) => {
  const router = useRouter();

  // Select the first image with Cloudinary optimization or fallback
  const displayImage = images?.[0]
    ? `${images[0]}?f_auto,q_auto,w_300,h_200,c_fill`
    : "/placeholder-image.jpg";

  // Handle card click to navigate to service details
  const handleClick = () => {
    router.push(`/services/${id}`);
  };

  return (
    <Card
      className='bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer'
      onClick={handleClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <img
        src={displayImage}
        alt={name || "Service"}
        className='w-full h-36 object-cover'
        loading='lazy'
      />
      <CardContent className='p-4 flex flex-col gap-2'>
        <h3 className='text-sm font-semibold text-gray-900 line-clamp-1'>
          {name || "Untitled Service"}
        </h3>
        <p className='text-sm text-gray-600 line-clamp-2'>
          {description || "No description available"}
        </p>
      </CardContent>
      <CardFooter className='px-4 pb-4 pt-2 flex justify-between items-center'>
        <span className='text-xs text-blue-600 font-medium'>
          {categoryId || "Uncategorized"}
        </span>
        <ChevronRightIcon className='w-5 h-5 text-gray-400' />
      </CardFooter>
    </Card>
  );
};

export default ServiceCard;
