"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Store, Users } from "lucide-react"; // install lucide-react if you haven't: `npm install lucide-react`

const UserProfile = dynamic(() => import("@/components/UserProfile"), {
  ssr: false,
});

export default function ToolBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isTalentHub = pathname === "/talent-hub";

  return (
   <header className="w-full px-4 py-4 mb-6 border-b border-gray-100 bg-white shadow-sm">
  <div className="flex flex-wrap items-center justify-between max-w-6xl mx-auto gap-4">
    
    {/* Logo */}
    <div className="flex items-center flex-shrink-0">
      <Image
        src="/assets/logo.png"
        alt="Logo"
        width={140}
        height={40}
        className="object-contain cursor-pointer"
        onClick={() => router.push("/")}
        priority
      />
    </div>

    {/* Nav + Sign Up container */}
    <div className="flex items-center gap-4 ml-auto flex-wrap">
      {/* Desktop nav */}
      <div className="hidden md:flex gap-4 items-center">
        <button
          onClick={() => router.push("/")}
          className={`border-2 rounded-xl px-4 py-1 transition duration-200 ${
            isHome ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"
          }`}
        >
          Market Place
        </button>
        <button
          onClick={() => router.push("/talent-hub")}
          className={`border-2 rounded-xl px-4 py-1 transition duration-200 ${
            isTalentHub ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"
          }`}
        >
          Talent Hub
        </button>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex items-center gap-2 border border-blue-500 rounded-xl px-2 py-1">
        <button
          onClick={() => router.push("/")}
          className={`p-2 rounded-md transition ${
            isHome ? "bg-yellow-100 text-yellow-600" : "text-yellow-900"
          }`}
          aria-label="Market Place"
        >
          <Store size={20} />
        </button>
        <button
          onClick={() => router.push("/talent-hub")}
          className={`p-2 rounded-md transition ${
            isTalentHub ? "bg-yellow-100 text-yellow-600" : "text-yellow-900"
          }`}
          aria-label="Talent Hub"
        >
          <Users size={20} />
        </button>
      </div>

      {/* Sign Up / UserProfile */}
      <div className="flex-shrink-0">
        <UserProfile />
      </div>
    </div>
  </div>
</header>

  );
}
