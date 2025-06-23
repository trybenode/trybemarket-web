"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import React from "react";

export default function MyServicesPage() {
  const router = useRouter();
  const services = [
    {
      id: 1,
      title: "Math Tutoring",
      category: "Tutoring",
      isActive: true,
    },
    {
      id: 2,
      title: "Math Tutoring",
      category: "Tutoring",
      isActive: true,
    },
    {
      id: 3,
      title: "Math Tutoring",
      category: "Tutoring",
      isActive: true,
    },
    {
      id: 4,
      title: "Math Tutoring",
      category: "Tutoring",
      isActive: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <Header title={""} />

      <div className="p-4">
        {/* Active Services Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Services
          </h2>
          <div className="space-y-3">
            {" "}
            {services
              .filter((service) => service.isActive)
              .map((service) => (
                <div
                  onClick={() => router.push(`/view-service/${service.id}`)}
                  key={service.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {/* Service Avatar/Icon */}
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />

                    {/* Service Info */}
                    <div>
                      <h3 className="text-base font-medium text-gray-900">
                        {service.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {service.category}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              ))}
          </div>
        </div>

        {/* Inactive Services Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Inactive Services
          </h2>
          <div className="space-y-3">
            {services
              .filter((service) => !service.isActive)
              .map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {/* Service Avatar/Icon */}
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />

                    {/* Service Info */}
                    <div>
                      <h3 className="text-base font-medium text-gray-900">
                        {service.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {service.category}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
