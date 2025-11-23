"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Package, Briefcase, Sparkles, ArrowRight } from "lucide-react";
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";
import Header from "@/components/Header";

const ToolBar = dynamic(() => import("@/components/ToolBar"), {
  ssr: false,
  loading: () => <ToolBarSkeleton />,
});

const options = [
  {
    id: 1,
    name: "List a Product",
    description: "Sell physical items, gadgets, or goods",
    icon: <Package size={40} strokeWidth={1.5} />,
    route: "/product-upload",
  },
  {
    id: 2,
    name: "List a Service",
    description: "Offer skills, expertise, or services",
    icon: <Briefcase size={40} strokeWidth={1.5} />,
    route: "/service-upload",
    badge: "Beta",
  },
];

export default function Upload() {
  const router = useRouter();

  return (
    <div className="flex flex-col px-4 py-6 max-w-6xl min-h-screen mx-auto bg-white">
      <Header title={"List Your Hustle"} />

      {/* Hero Section */}
      <div className="text-center mt-12 mb-12 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
          What would you like to list?
        </h1>
        <p className="text-gray-600 text-base">
          Choose how you want to showcase your business
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full mb-16">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => router.push(opt.route)}
            className="group relative flex flex-col items-start p-8 bg-white border border-gray-200 rounded-xl hover:border-[rgb(37,99,235)] hover:shadow-lg transition-all duration-300"
          >
            {/* Beta Badge */}
            {opt.badge && (
              <div className="absolute top-4 right-4 bg-[rgb(37,99,235)] text-white text-xs font-medium px-3 py-1 rounded-full">
                {opt.badge}
              </div>
            )}

            {/* Icon */}
            <div className="p-3 bg-gray-50 rounded-lg mb-4 text-gray-700 group-hover:bg-blue-50 group-hover:text-[rgb(37,99,235)] transition-colors duration-300">
              {opt.icon}
            </div>

            {/* Content */}
            <div className="text-left flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {opt.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {opt.description}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 group-hover:text-[rgb(37,99,235)] transition-colors">
              <span>Get started</span>
              <ArrowRight size={16} strokeWidth={2} />
            </div>
          </button>
        ))}
      </div>

      {/* Benefits Section */}
      <div className="max-w-3xl mx-auto w-full mb-12">
        <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-[rgb(37,99,235)]" strokeWidth={2} />
            <h3 className="text-lg font-semibold text-gray-900">
              Why list on TrybeMarket?
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-gray-900 text-sm mb-1">
                  Reach students
                </p>
                <p className="text-sm text-gray-600">
                  Connect with campus communities nationwide
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-gray-900 text-sm mb-1">
                  Easy management
                </p>
                <p className="text-sm text-gray-600">
                  Simple tools to upload and track your listings
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-gray-900 text-sm mb-1">
                  Grow your business
                </p>
                <p className="text-sm text-gray-600">
                  Premium features to boost visibility and sales
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Need help?{" "}
          <a href="/help" className="text-[rgb(37,99,235)] hover:underline font-medium">
            View our listing guide
          </a>
        </p>
      </div>
    </div>
  );
}
