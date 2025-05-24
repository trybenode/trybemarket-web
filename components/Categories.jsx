"use client"

import { useState, useEffect } from "react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export default function Categories() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'categories'))
        const categoryData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          const shuffledCategories = shuffleArray([...categoryData]).slice(0, 6);
        setCategories(shuffledCategories)
      } catch (err) {
        console.error('Error fetching categories:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // const handleCategoryClick = async (categoryID, categoryName) => {
  //   try {
  //     setLoading(true)

  //     const productsQuery = query(
  //       collection(db, 'products'),
  //       where('categoryId', '==', categoryID)
  //     )
  //     const querySnapshot = await getDocs(productsQuery)
  //     const products = querySnapshot.docs.map((doc) => ({
  //       id: doc.id,
  //       ...doc.data(),
  //     }))

  //     router.push(`/categories/${categoryID}?categoryName=${encodeURIComponent(categoryName)}`)
  //   } catch (err) {
  //     console.error('Error fetching products:', err)
  //   } finally {
  //     setLoading(false)
  //   }
  // }
const handleCategoryClick = (categoryID, categoryName) => {
  setSelectedCategory(categoryID)
  router.push(`/categories/${categoryID}?categoryName=${encodeURIComponent(categoryName)}`)
}

  return (
    <div className="my-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 p-1">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              className={`rounded-full border-yellow-500 ${
                selectedCategory === category.id ? "bg-blue-600 text-white" : "bg-white text-gray-700"
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
  )
}
