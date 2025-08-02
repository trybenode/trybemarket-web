'use client'

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Package, Briefcase } from 'lucide-react';
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";
import Header from "@/components/Header";

const ToolBar = dynamic(() => import("@/components/ToolBar"), {
  ssr: false,
  loading: () => <ToolBarSkeleton />,
});

const options = [
  { id: 1, name: 'Product', icon: <Package size={40} color="blue" />, route: '/product-upload' },
  { id: 2, name: 'Skill/Services [Beta]', icon: <Briefcase size={40} color="blue" />, route: '/service-upload' },
];

export default function Upload() {
  const router = useRouter();

  return (
    <div className="flex flex-col px-4  py-4 max-w-6xl min-h-screen mx-auto bg-white">
      {/* <ToolBar /> */}
      <Header title={"List Your Hustle"} />

      <div className=" grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 justify-items-center">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => router.push(opt.route)}
            className="flex flex-col items-center justify-center p-6 w-64 h-48 border border-yellow-300 rounded-lg shadow-sm transition-transform hover:shadow-lg hover:scale-105 "
          >
            {opt.icon}
            <p className="text-blue-700 mt-6 font-medium text-center">{opt.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
