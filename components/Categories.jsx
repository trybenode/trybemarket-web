"use client";

import React,{ useState, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { collection, getDocs,} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import CategoryBarSkeleton from "./ui/CategoryBarSkeleton";

export default React.memo(function Categories() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "categories"));
        const categoryData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const shuffledCategories = shuffleArray([...categoryData]);
        setCategories(shuffledCategories);
      } catch (err) {
        console.error("Error fetching categories:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryClick = (categoryID, categoryName) => {
    setSelectedCategory(categoryID);
    router.push(
      `/categories/${categoryID}?categoryName=${encodeURIComponent(
        categoryName
      )}`
    );
  };
  if (loading) return <CategoryBarSkeleton />;

  return (
    <div className="my-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 p-1">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              className={`rounded-full ${
                selectedCategory === category.id
                  ? ""
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-yellow-deep hover:bg-brand-yellow-soft hover:text-slate-900"
              }`}
              onClick={() => handleCategoryClick(category.id, category.name)}
            >
              {category.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
})
