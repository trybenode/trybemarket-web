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
