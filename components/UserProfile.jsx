"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import dynamic from "next/dynamic";

const LogoutModal = dynamic(() => import("@/components/LogoutModal"), {
  loading: () => <Loader/>, 
  ssr: false,
});
import {
  User,
  LogOut,
  Upload,
  Store,
  MessageSquare,
  Home,
  CreditCard,
  Pencil,
  CheckCircle2,
  Heart,
  Loader,
  Compass,
} from "lucide-react";
import { MdPeople, MdPeopleOutline, MdVerified } from "react-icons/md";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";

export default React.memo( function UserProfile() {
  const { currentUser, setCurrentUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isLoggedIn = !!currentUser;
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsModalOpen(false);
      router.push("/");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Logout error:", error);
      }
    }
  };

  return (
    <div className='relative'>
      {!isLoggedIn ? (
        <div className='flex items-center space-x-4'>
          <Link
            href='/login'
            className='text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-blue-500 rounded-md px-4 py-2'
          >
            Login
          </Link>
          <Link
            href='/signup'
            className='text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-blue-500 rounded-md px-4 py-2'
          >
            Sign Up
          </Link>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition-all duration-200'
              aria-label='Open user profile menu'
            >
              <Avatar className='h-10 w-10 cursor-pointer border-2 border-blue-500 hover:border-blue-600 transition-colors duration-200 aspect-square'>
                <AvatarImage
                  src={
                    currentUser?.profilePicture || "/images/default-avatar.png"
                  }
                  alt={currentUser?.fullName || "User"}
                  className='object-cover w-full h-full'
                />
                <AvatarFallback className='bg-gray-100 text-gray-600'>
                  <User className='h-5 w-5' />
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            className='w-64 bg-white shadow-lg rounded-lg border border-gray-100 p-2 mt-2'
          >
            <div className='flex items-center gap-3 p-3'>
              <Avatar className='h-10 w-10 aspect-square'>
                <AvatarImage
                  src={
                    currentUser?.profilePicture || "/images/default-avatar.png"
                  }
                  alt={currentUser?.fullName || "User"}
                  className='object-cover w-full h-full'
                />
                <AvatarFallback className='bg-gray-100 text-gray-600'>
                  <User className='h-5 w-5' />
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col'>
                <div className='flex items-center space-x-2'>
                  <p className='text-sm font-semibold text-gray-800 truncate max-w-[150px]'>
                    {currentUser?.fullName || "User"}
                  </p>
                  {currentUser?.isVerified && (
                    <MdVerified
                      className='h-5 w-5 text-green-500'
                      aria-label='Verified User'
                      title='Verified User'
                    />
                  )}
                </div>
                <p className='text-xs text-gray-500 truncate max-w-[180px]'>
                  {currentUser?.email}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator className='bg-gray-200' />
            <DropdownMenuItem asChild>
              <Link
                href='/'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Home className='mr-2 h-4 w-4' />
                Marketplace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/explore'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Compass className='mr-2 h-4 w-4' />
                Explore Services
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/talent-hub'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <MdPeopleOutline className='mr-2 h-4 w-4' />
               Talent Hub
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/my-shop'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Store className='mr-2 h-4 w-4' />
                My Shop
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/messages'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <MessageSquare className='mr-2 h-4 w-4' />
                Messages
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/sell'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Upload className='mr-2 h-4 w-4' />
                Sell
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/favorites'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Heart className='mr-2 h-4 w-4' />
                Favorite
              </Link>
            </DropdownMenuItem>
            {!currentUser?.isVerified && (
              <DropdownMenuItem asChild>
                <Link
                  href='/kyc'
                  className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
                >
                  <CheckCircle2 className='mr-2 h-4 w-4' />
                  KYC Registration
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link
                href='/edit-profile'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Pencil className='mr-2 h-4 w-4' />
                Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href='/subscription'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <CreditCard className='mr-2 h-4 w-4' />
                Subscription
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className='bg-gray-200' />
            <DropdownMenuItem
              onClick={() => setIsModalOpen(true)}
              className='flex items-center px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors duration-150 text-sm font-medium cursor-pointer'
            >
              <LogOut className='mr-2 h-4 w-4' />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <LogoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
})
