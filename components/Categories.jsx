"use client"

import { useState } from "react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

// Sample categories - replace with your actual categories
const categories = [
  { id: "all", name: "All" },
  { id: "electronics", name: "Electronics" },
  { id: "clothing", name: "Clothing" },
  { id: "books", name: "Books" },
  { id: "furniture", name: "Furniture" },
  { id: "sports", name: "Sports" },
  { id: "toys", name: "Toys" },
  { id: "beauty", name: "Beauty" },
  { id: "automotive", name: "Automotive" },
]

export default function Categories() {
  const [selectedCategory, setSelectedCategory] = useState("all")

  return (
    <div className="my-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 p-1">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              className={`rounded-full ${
                selectedCategory === category.id ? "bg-blue-600 text-white" : "bg-white text-gray-700"
              }`}
              onClick={() => setSelectedCategory(category.id)}
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
