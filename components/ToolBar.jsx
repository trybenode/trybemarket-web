"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import React from "react";
import { useRouter } from "next/navigation";

const UserProfile = dynamic(() => import("@/components/UserProfile"), {
  ssr: false,
});

export default React.memo(function ToolBar() {
  const router = useRouter();

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

        {/* Right Section: Download + Profile */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Download Button */}
          <a
            href="https://play.google.com/store/apps/details?id=com.markettrybe.myexpoapp"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            Download App
          </a>

          {/* User Profile */}
          <UserProfile />
        </div>

      </div>
    </header>
  );
});
