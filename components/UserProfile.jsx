"use client"

import { useState } from "react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, LogOut, ShoppingBag, MessageSquare, Settings } from "lucide-react"

export default function UserProfile() {
  const [isLoggedIn, setIsLoggedIn] = useState(true)

  if (!isLoggedIn) {
    return (
      <div className="flex items-center space-x-2">
        <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
          Login
        </Link>
        <span className="text-gray-300">|</span>
        <Link href="/signup" className="text-sm font-medium text-blue-600 hover:underline">
          Sign Up
        </Link>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none">
          <Avatar className="h-9 w-9 cursor-pointer border-2 border-blue-500">
            <AvatarImage src="/placeholder.svg?height=36&width=36" alt="User" />
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center justify-start gap-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">User Name</p>
            <p className="text-xs text-gray-500">user@example.com</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my-shop" className="flex cursor-pointer items-center">
            <ShoppingBag className="mr-2 h-4 w-4" />
            <span>My Shop</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/messages" className="flex cursor-pointer items-center">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Messages</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex cursor-pointer items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-center text-red-500 focus:text-red-500"
          onClick={() => setIsLoggedIn(false)}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
