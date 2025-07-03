"use client";
import { useState } from "react";

const CategoryTabs = ({ categories, onSelectCategory }) => {
  const [activeCategory, setActiveCategory] = useState("All");

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onSelectCategory(category);
  };

  return (
    <div className='w-full overflow-x-auto scrollbar-hide'>
      <div className='flex space-x-3 w-max pb-2'>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors duration-200 ${
              activeCategory === category
                ? "bg-blue-600 text-white"
                : "bg-white border border-yellow-400 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
