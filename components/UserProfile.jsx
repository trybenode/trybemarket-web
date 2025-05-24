// components/ui/UserProfile.js
"use client";

import { useContext } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  LogOut,
  ShoppingBag,
  Upload,
  MessageSquare,
  Settings,
  CheckCircle2, // Using CheckCircle2 for a more refined verified badge
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";

export default function UserProfile() {
  const { currentUser, setCurrentUser } = useUser();
  const isLoggedIn = !!currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null); // Clear user in context
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
            className='text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-bg duration-200 ease-in-out focus:outline-none border border-blue-500 rounded-md px-4 py-2'
          >
            Login
          </Link>
          <Link
            href='/signup'
            className='text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-bg duration-200 ease-in-out focus:outline-none border border-blue-500 rounded-md px-4 py-2'
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
              <Avatar className='h-10 w-10 cursor-pointer border-2 border-blue-500 hover:border-blue-600 transition-colors duration-200'>
                <AvatarImage
                  src={
                    currentUser?.profilePicture || "/images/default-avatar.png"
                  }
                  alt={currentUser?.fullName || "User"}
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
              <Avatar className='h-10 w-10'>
                <AvatarImage
                  src={
                    currentUser?.profilePicture || "/images/default-avatar.png"
                  }
                  alt={currentUser?.fullName || "User"}
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
                    <CheckCircle2
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
                href='/my-shop'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <ShoppingBag className='mr-2 h-4 w-4' />
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
            {!currentUser?.isVerified && (
              <DropdownMenuItem asChild>
                <Link
                  href='/kyc'
                  className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
                >
                  <MessageSquare className='mr-2 h-4 w-4' />
                  Kyc Registration
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link
                href='/settings'
                className='flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium'
              >
                <Settings className='mr-2 h-4 w-4' />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className='bg-gray-200' />
            <DropdownMenuItem
              onClick={handleLogout}
              className='flex items-center px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors duration-150 text-sm font-medium cursor-pointer'
            >
              <LogOut className='mr-2 h-4 w-4' />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
