import React from 'react'
import Image from 'next/image'

export default function ToolBarSkeleton() {
  return (
     <div className="flex items-center justify-between py-4 mb-6 px-4 animate-pulse">
      {/* Actual Logo */}
      <Image
        src="/assets/logo.png"
        alt="Logo"
        width={150}
        height={40}
        className="object-contain"
      />


      {/* User profile skeleton */}
      <div className="h-10 w-10 bg-gray-200 rounded-full" />
    </div>
  )
}
