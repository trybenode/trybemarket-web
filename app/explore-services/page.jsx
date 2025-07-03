"use client";

import { useState, useEffect } from "react";
import CategoryTabs from "../../components/CategoryTabs";
import ServiceCard from "../../components/ServiceCard";
import UserProfile from "@/components/UserProfile";
import { useServices } from "@/hooks/useServices";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import ServiceCardSkeleton from "@/components/ui/ServiceCardSkeleton";
import CategoryBarSkeleton from "@/components/ui/CategoryBarSkeleton";
import useUserStore from "@/lib/userStore";
import dynamic from "next/dynamic";

const ServiceSearchBar = dynamic(
  () => import("@/components/ServiceSearchBar"),
  {
    ssr: false,
    loading: () => (
      <div className='h-12 bg-gray-100 rounded-md animate-pulse' />
    ),
  }
);

export default function Explore() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filteredServices, setFilteredServices] = useState([]);
  const [hasSearch, setHasSearch] = useState(false);
  const {
    services,
    initialLoading,
    isFetchingMore,
    error: servicesError,
    hasMore,
    loadMore,
  } = useServices(selectedCategory);
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useServiceCategories();
  const selectedUniversity = useUserStore((state) =>
    state.getSelectedUniversity()
  );

  // Reset selectedCategory if it’s no longer valid
  useEffect(() => {
    if (!categoriesLoading && !categories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [categories, categoriesLoading, selectedCategory]);

  // Sync filteredServices with services when no search is active
  useEffect(() => {
    if (!hasSearch) {
      setFilteredServices(services);
    }
  }, [services, hasSearch]);

  return (
    <div className='max-w-6xl mx-auto py-6 px-4'>
      <div className='flex justify-between items-center mb-4'>
        <h1 className='text-2xl font-bold text-gray-800'>Explore Services</h1>
        <UserProfile />
      </div>

      <div className='mb-4'>
        <ServiceSearchBar
          services={services}
          onResults={(filtered, active) => {
            setFilteredServices(filtered);
            setHasSearch(active);
          }}
        />
      </div>

      {categoriesLoading ? (
        <CategoryBarSkeleton />
      ) : categoriesError ? (
        <p className='text-center text-red-500 mb-4'>
          Error loading categories: {categoriesError}
        </p>
      ) : (
        <CategoryTabs
          categories={categories}
          onSelectCategory={setSelectedCategory}
        />
      )}

      {initialLoading ? (
        <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredServices.length ? (
        <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6'>
          {filteredServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : (
        <div className='flex flex-col items-center justify-center h-[50vh]'>
          <p className='text-center text-lg text-red-500'>
            {hasSearch
              ? "No services found for this search."
              : selectedUniversity
                ? `No services of this category in ${selectedUniversity} yet. Be the first to upload!`
                : "No services found. Please check your internet connection or try again."}
          </p>
        </div>
      )}

      {isFetchingMore && (
        <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6'>
          {Array.from({ length: 8 }).map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      )}

      {hasMore &&
        !isFetchingMore &&
        filteredServices.length > 0 &&
        !hasSearch && (
          <div className='flex justify-center mt-6'>
            <button
              onClick={loadMore}
              className='px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600'
            >
              Load More
            </button>
          </div>
        )}

      {(servicesError || categoriesError) && (
        <p className='text-center text-red-500 mt-4'>
          Error: {servicesError || categoriesError}
        </p>
      )}
    </div>
  );
}
