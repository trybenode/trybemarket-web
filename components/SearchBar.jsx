"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function SearchBar({ onResults }) {
  const [searchQuery, setSearchQuery] = useState("")

  // This is a placeholder for actual search functionality
  // You would replace this with your actual search logic
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim()) {
        // Placeholder for actual search implementation
        // In a real app, you would fetch results from your database
        console.log("Searching for:", searchQuery)

        // For now, we're just passing an empty array and search status
        onResults([], searchQuery.trim().length > 0)
      } else {
        onResults([], false)
      }
    }, 500)

    return () => clearTimeout(delaySearch)
  }, [searchQuery, onResults])

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <Input
        type="text"
        placeholder="Search products..."
        className="pl-10 py-2 rounded-full border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  )
}
