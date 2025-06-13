"use client";

import { useState } from "react";
import CategoryTabs from "../../components/CategoryTabs";
import ServiceCard from "../../components/ServiceCard";
import UserProfile from "@/components/UserProfile";
const services = [
  {
    id: 1,
    category: "Tutoring",
    title: "Advanced Math Tutoring",
    description:
      "Experienced tutor with over 5 years of expertise in algebra, calculus, and geometry.",
    image: "/placeholder.jpg",
  },
  {
    id: 2,
    category: "Creative",
    title: "Danlos Visuals Studio",
    description:
      "Custom-designed flyers, banners, and promotional materials to boost your business sales.",
    image: "/placeholder.jpg",
  },
  {
    id: 3,
    category: "Creative",
    title: "Ishots Photography",
    description:
      "Professional photography services capturing stunning portraits and event moments with artistic flair.",
    image: "/placeholder.jpg",
  },
  {
    id: 4,
    category: "Beauty & Personal Care",
    title: "Funky Hairs Salon",
    description:
      "Specializing in trendy haircuts, braids, and personalized styling for all hair types.",
    image: "/placeholder.jpg",
  },
  {
    id: 5,
    category: "Food & Catering",
    title: "Abdul’s Cakes & Pastries",
    description:
      "Artisanal cakes and pastries crafted to perfection for weddings, birthdays, and celebrations.",
    image: "/placeholder.jpg",
  },
  {
    id: 6,
    category: "Craft",
    title: "Creative Craftworks",
    description:
      "Handcrafted decor and functional items tailored to your unique style and needs.",
    image: "/placeholder.jpg",
  },
];

export default function Explore() {
  const categories = [
    "All",
    "Tutoring",
    "Creative",
    "Craft",
    "Beauty & Personal Care",
    "Food & Catering",
  ];
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredServices =
    selectedCategory === "All"
      ? services
      : services.filter((s) => s.category === selectedCategory);

  return (
    <div className='max-w-6xl mx-auto py-6 px-4'>
      <div className='flex justify-between items-center mb-4'>
        <h1 className='text-2xl font-bold text-gray-800'>Explore Services</h1>
        <UserProfile />
      </div>

      <div className='mb-4'>
        <input
          type='text'
          placeholder='Search for services...'
          className='w-full px-4 py-2 border border-gray-200 rounded-3xl focus:outline-none focus:ring-1 focus:ring-yellow-500'
        />
      </div>

      <CategoryTabs
        categories={categories}
        onSelectCategory={setSelectedCategory}
      />

      <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6'>
        {filteredServices.map((service) => (
          <ServiceCard key={service.id} {...service} />
        ))}
      </div>
    </div>
  );
}





// "use client";

// import { useState } from "react";
// import CategoryTabs from "../../components/CategoryTabs";
// import ServiceCard from "../../components/ServiceCard";
// import UserProfile from "@/components/UserProfile";
// import { useServices } from "@/hooks/useServices";

// // Skeleton loader component (simple version, adapt as needed)
// const ServiceCardSkeleton = () => (
//   <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
//     <div className="h-32 bg-gray-200 rounded mb-4"></div>
//     <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
//     <div className="h-4 bg-gray-200 rounded w-1/2"></div>
//   </div>
// );

// const categories = [
//   "All",
//   "Tutoring",
//   "Creative",
//   "Craft",
//   "Beauty & Personal Care",
//   "Food & Catering",
// ];

// export default function Explore() {
//   const [selectedCategory, setSelectedCategory] = useState("All");
//   const { services, initialLoading, isFetchingMore, error, hasMore, loadMore } = useServices(selectedCategory);

//   return (
//     <div className="max-w-6xl mx-auto py-6 px-4">
//       <div className="flex justify-between items-center mb-4">
//         <h1 className="text-2xl font-bold text-gray-800">Explore Services</h1>
//         <UserProfile />
//       </div>

//       <div className="mb-4">
//         <input
//           type="text"
//           placeholder="Search for services..."
//           className="w-full px-4 py-2 border border-gray-200 rounded-3xl focus:outline-none focus:ring-1 focus:ring-yellow-500"
//         />
//       </div>

//       <CategoryTabs
//         categories={categories}
//         onSelectCategory={setSelectedCategory}
//       />

//       {initialLoading ? (
//         <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
//           {Array.from({ length: 6 }).map((_, i) => (
//             <ServiceCardSkeleton key={i} />
//           ))}
//         </div>
//       ) : services.length ? (
//         <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
//           {services.map((service) => (
//             <ServiceCard key={service.id} {...service} />
//           ))}
//         </div>
//       ) : (
//         <div className="flex flex-col items-center justify-center h-[50vh]">
//           <p className="text-center text-lg text-red-500">
//             {selectedUniversity
//               ? `No services in ${selectedUniversity} yet. Be the first to upload!`
//               : "No services found. Please check your internet connection or try again."}
//           </p>
//         </div>
//       )}

//       {isFetchingMore && (
//         <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
//           {Array.from({ length: 6 }).map((_, i) => (
//             <ServiceCardSkeleton key={i} />
//           ))}
//         </div>
//       )}

//       {hasMore && !isFetchingMore && services.length > 0 && (
//         <div className="flex justify-center mt-6">
//           <button
//             onClick={loadMore}
//             className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
//           >
//             Load More
//           </button>
//         </div>
//       )}

//       {error && <p className="text-center text-red-500 mt-4">Error: {error}</p>}
//     </div>
//   );
// }