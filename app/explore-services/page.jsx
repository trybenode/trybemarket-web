"use client";

import { useState, useEffect } from "react";
import CategoryTabs from "../../components/CategoryTabs";
import ServiceCard from "../../components/ServiceCard";
import ToolBar from "@/components/ToolBar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
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
      <div className='h-11 animate-pulse rounded-full bg-slate-200/70' />
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

  // The user store is only initialised by the login/signup pages and after
  // sign-in, so a signed-out visitor landing here directly (or via the app's
  // "Explore Services" shortcut) would otherwise wait on it forever.
  useEffect(() => {
    const store = useUserStore.getState();
    if (!store.isInitialized) store.loadUser();
  }, []);

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

  // Same grid as the marketplace on the home page, so the two feel like one app.
  const gridClass = "mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4";

  return (
    <div className='min-h-screen bg-slate-50'>
      <ToolBar />

      <div className='mx-auto max-w-6xl px-3 pb-12 pt-4 sm:px-4'>
        <div className='mb-4 flex items-center gap-2'>
          <h1 className='text-2xl font-extrabold tracking-tight text-slate-900'>Explore services</h1>
          <Badge variant='brand'>Beta</Badge>
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
          <p className='mb-4 text-center text-sm text-red-600'>
            Error loading categories: {categoriesError}
          </p>
        ) : (
          <CategoryTabs
            categories={categories}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {initialLoading ? (
          <div className={gridClass}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredServices.length ? (
          <div className={gridClass}>
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className='mt-6 flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center'>
            <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary'>
              <Briefcase className='h-8 w-8' />
            </div>
            <p className='max-w-sm text-sm text-slate-600'>
              {hasSearch
                ? "No services found for this search."
                : selectedUniversity
                  ? `No services of this category in ${selectedUniversity} yet. Be the first to upload!`
                  : "Choose your campus to see the services offered by students there."}
            </p>
            {!hasSearch && !selectedUniversity && (
              <Button asChild className='mt-5'>
                <Link href='/select-university'>Choose your campus</Link>
              </Button>
            )}
          </div>
        )}

        {isFetchingMore && (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {hasMore &&
          !isFetchingMore &&
          filteredServices.length > 0 &&
          !hasSearch && (
            <div className='mt-6 flex justify-center'>
              <Button variant='outline' size='lg' onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}

        {(servicesError || categoriesError) && (
          <p className='mt-4 text-center text-sm text-red-600'>
            Error: {servicesError || categoriesError}
          </p>
        )}
      </div>
    </div>
  );
}
