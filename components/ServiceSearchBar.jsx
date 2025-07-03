// components/ServiceSearchBar.jsx
"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

export default React.memo(function ServiceSearchBar({ services, onResults }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter services based on debounced query
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      onResults(services, false); // Return all services if query is empty
      return;
    }

    const filtered = services.filter((service) => {
      const query = debouncedQuery.toLowerCase().trim();
      return (
        service.name?.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query) ||
        service.categoryId?.toLowerCase().includes(query)
      );
    });

    onResults(filtered, true);
  }, [debouncedQuery, services, onResults]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className='relative'>
      <div className='absolute inset-y-0 left-3 flex items-center pointer-events-none'>
        <Search className='h-5 w-5 text-gray-400' />
      </div>
      <input
        type='text'
        placeholder='Search for services...'
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className='w-full pl-10 pr-10 py-2 border border-gray-200 rounded-3xl focus:outline-none focus:ring-1 focus:ring-yellow-500'
      />
      {searchQuery && (
        <button
          onClick={handleClearSearch}
          className='absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600'
        >
          <X className='h-5 w-5' />
        </button>
      )}
    </div>
  );
});
