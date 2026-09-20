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
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
              activeCategory === category
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-yellow-deep hover:bg-brand-yellow-soft"
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
