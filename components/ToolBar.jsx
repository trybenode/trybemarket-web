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
    <header className="flex items-center justify-between w-full max-w-6xl px-4 py-4 mb-6 mx-auto overflow-x-hidden">
      <Image
        src="/assets/logo.png?height=50&width=150"
        alt="Logo"
        width={150}
        height={40}
        className="object-contain flex-shrink-0 cursor-pointer"
        onClick={() => router.push("/")}
      />

      <nav className="flex gap-4 items-center font-medium flex-shrink">
        {/* Desktop buttons */}
        <button
          onClick={() => router.push("/")}
          className={`
            hidden md:block border-2 rounded-xl px-4 py-1 transition
            ${isHome ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"}
          `}
        >
          Market Place
        </button>
        <button
          onClick={() => router.push("/talent-hub")}
          className={`
            hidden md:block border-2 rounded-xl px-4 py-1 transition
            ${isTalentHub ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"}
          `}
        >
          Talent Hub
        </button>

        {/* Mobile icons */}
        <span className="md:hidden border-2 rounded-2xl gap-3 flex p-1 border-blue-500">

        <button
          onClick={() => router.push("/")}
          className={`
            p-2  transition
            ${isHome ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"}
            `}
            aria-label="Market Place"
            >
          <Store size={20} />
        </button>

        <button
          onClick={() => router.push("/talent-hub")}
          className={`
            p-2  transition
            ${isTalentHub ? "border-yellow-900 text-yellow-500" : "border-yellow-500 text-yellow-900"}
            `}
            aria-label="Talent Hub"
            >
          <Users size={20} />
        </button>
            </span>
      </nav>

      <div className="flex-shrink-0 w-10">
        <UserProfile />
      </div>
    </header>
  );
}
