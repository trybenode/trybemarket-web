'use client'

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Package, Briefcase, Sparkles, TrendingUp } from 'lucide-react';
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";
import Header from "@/components/Header";

const ToolBar = dynamic(() => import("@/components/ToolBar"), {
  ssr: false,
  loading: () => <ToolBarSkeleton />,
});

const options = [
  { 
    id: 1, 
    name: 'List a Product', 
    description: 'Sell physical items, gadgets, or goods',
    icon: <Package size={48} />, 
    route: '/product-upload',
    color: 'blue',
    bgGradient: 'from-blue-50 to-blue-100',
    borderColor: 'border-blue-300',
    hoverBorder: 'hover:border-blue-500',
    iconColor: 'text-blue-600'
  },
  { 
    id: 2, 
    name: 'List a Service', 
    description: 'Offer skills, expertise, or services',
    icon: <Briefcase size={48} />, 
    route: '/service-upload',
    color: 'purple',
    bgGradient: 'from-purple-50 to-purple-100',
    borderColor: 'border-purple-300',
    hoverBorder: 'hover:border-purple-500',
    iconColor: 'text-purple-600',
    badge: 'Beta'
  },
];

export default function Upload() {
  const router = useRouter();

  return (
    <div className="flex flex-col px-4 py-6 max-w-7xl min-h-screen mx-auto bg-gradient-to-br from-gray-50 to-blue-50">
      <Header title={"List Your Hustle"} />

      {/* Hero Section */}
      <div className="text-center mt-8 mb-6 max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          What Would You Like to List?
        </h1>
        <p className="text-gray-600 text-lg">
          Choose how you want to showcase your business on TrybeMarket
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mt-8">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => router.push(opt.route)}
            className={`group relative flex flex-col items-center justify-center p-8 bg-gradient-to-br ${opt.bgGradient} border-2 ${opt.borderColor} ${opt.hoverBorder} rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:scale-105 hover:-translate-y-1`}
          >
            {/* Beta Badge */}
            {opt.badge && (
              <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                {opt.badge}
              </div>
            )}

            {/* Icon Container */}
            <div className={`p-5 ${opt.iconColor} bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300`}>
              {opt.icon}
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-${opt.color}-600 transition-colors">
              {opt.name}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 text-center mb-4">
              {opt.description}
            </p>

            {/* Hover Arrow */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <svg 
                className={`w-6 h-6 ${opt.iconColor}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Benefits Section */}
      <div className="mt-12 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h3 className="text-xl font-bold text-gray-900">Why List on TrybeMarket?</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Reach Students</p>
                <p className="text-xs text-gray-600 mt-1">Connect with campus communities</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Easy Management</p>
                <p className="text-xs text-gray-600 mt-1">Simple upload and tracking tools</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Grow Your Business</p>
                <p className="text-xs text-gray-600 mt-1">Premium features to boost sales</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-center mt-8 text-sm text-gray-500">
        <p>Need help? Check out our{" "}
          <a href="/help" className="text-blue-600 hover:underline font-medium">
            listing guide
          </a>
        </p>
      </div>
    </div>
  );
}
