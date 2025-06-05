"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import React from "react";
import { useRouter} from "next/navigation";


const UserProfile = dynamic(() => import("@/components/UserProfile"), {
  ssr: false,
});

export default function ToolBar() {
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
      
      {/* Sign Up / UserProfile */}
      <div className="flex-shrink-0">
        <UserProfile />
      </div>
   
  </div>
</header>

  );
}
