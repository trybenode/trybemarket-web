"use client";
import React from "react";
import dynamic from "next/dynamic";
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";

const ToolBar = dynamic(() => import("@/components/ToolBar"), {
  loading: () => <ToolBarSkeleton />,
  ssr: false,
});

export default function TalentHub() {
  return (
    <div className="flex flex-col min-h-screen max-w-6xl mx-auto bg-white px-4 py-6">
      <ToolBar />

      <div className="mt-8 text-gray-800 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-yellow-900">
          Calling All Service Providers & Artisans!
        </h1>

        <p>
          From <span className="font-medium">lash techs, nail techs, hairstylists, photographers, makeup artists, tailors, designers</span>,
          to those offering <span className="font-medium">project help, academic support, or tech-related services</span> — we’ve got something
          exciting brewing just for you!
        </p>

        <p>
          Whether you're just getting started or already thriving in your craft, this platform is being designed to help you:
        </p>

        <ul className="list-disc list-inside ml-4">
          <li>Showcase your skills and portfolio</li>
          <li>Connect with potential student clients and collaborators</li>
          <li>Grow your personal brand and business</li>
        </ul>

        <p className="font-semibold text-yellow-700">
          🚀 Stay tuned — the future of digital talent discovery is almost here!
        </p>
      </div>
    </div>
  );
}
