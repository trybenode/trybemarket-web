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
  loading: () => <Loader />,
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
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const menuItems = [
  { label: "Marketplace", href: "/", icon: Home },
  { label: "Explore Services[Beta]", href: "/explore", icon: Compass },
  // { label: "Talent Hub [Beta]", href: "/talent-hub", icon: MdPeopleOutline },
  { label: "My Shop", href: "/my-shop", icon: Store },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Sell", href: "/upload", icon: Upload },
  { label: "Favorite", href: "/favorites", icon: Heart },
  {
    label: "KYC Registration",
    href: "/kyc",
    icon: CheckCircle2,
    requiresVerification: true,
  },
  { label: "Edit Profile", href: "/edit-profile", icon: Pencil },
  { label: "Subscription", href: "/subscription", icon: CreditCard },
];

export default React.memo(function UserProfile() {
  const { currentUser, setCurrentUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isLoggedIn = !!currentUser;
  const router = useRouter();
  const hasUnreadMessages = useUnreadMessages();

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
    <div className="relative">
      {!isLoggedIn ? (
        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-blue-500 rounded-md px-4 py-2"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-blue-500 rounded-md px-4 py-2"
          >
            Sign Up
          </Link>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition-all duration-200"
              aria-label="Open user profile menu"
            >
              <div className="relative">
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
                {hasUnreadMessages && (
                  <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white" />
                )}
              </div>

            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 bg-white shadow-lg rounded-lg border border-gray-100 p-2 mt-2"
          >
            <div className="flex items-center gap-3 p-3">
              <Avatar className="h-10 w-10 aspect-square">
                <AvatarImage
                  src={
                    currentUser?.profilePicture || "/images/default-avatar.png"
                  }
                  alt={currentUser?.fullName || "User"}
                  className="object-cover w-full h-full"
                />
                <AvatarFallback className="bg-gray-100 text-gray-600">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-[150px]">
                    {currentUser?.fullName || "User"}
                  </p>
                  {currentUser?.isVerified && (
                    <MdVerified
                      className="h-5 w-5 text-green-500"
                      aria-label="Verified User"
                      title="Verified User"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate max-w-[180px]">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator className='bg-gray-200' />
          
           
            {menuItems.map((item, index) => {
              if (item.requiresVerification && currentUser?.isVerified)
                return null;

              const Icon = item.icon;

              return (
                <DropdownMenuItem asChild key={index}>
                  <Link
                    href={item.href}
                    className="flex items-center px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors duration-150 text-sm font-medium"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator className="bg-gray-200" />

            <DropdownMenuItem
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors duration-150 text-sm font-medium cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
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
});
