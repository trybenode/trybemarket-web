import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";

export default function ServicePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header with back button */}
      <div className="flex items-center p-4">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Hero Image Section */}
      <div className="relative mx-4 mb-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
          <Image
            src={require("/public/assets/photographer-hero.jpg")}
            alt="Professional photographer working with camera equipment"
            fill
            className="object-cover"
            priority
          />

          {/* Navigation arrows */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 space-y-6">
        {/* Service Title and Description */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Ishots Photography
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Expert photography capturing timeless moments with creativity.
            Flexible hours and competitive rates. Contact Me for more details.
          </p>
        </div>

        {/* Pricing */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-1">Pricing</h2>
          <p className="text-gray-600 text-sm">$20/hr</p>
        </div>

        {/* Provider */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Provider</h2>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                AD
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-900">Allen Douglas</p>
              <p className="text-xs text-gray-500">Available</p>
            </div>
          </div>
        </div>

        {/* Message */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Message</h2>
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              className="flex-1 min-h-[44px] max-h-[44px] resize-none bg-gray-100 border-0 text-sm"
            />
            <Button
              size="icon"
              className="h-11 w-11 bg-blue-500 hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Location */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Location</h2>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <p className="text-sm text-gray-600">Banana Island, Pakistan.</p>
          </div>
        </div>

        {/* Availability */}
        <div className="pb-6">
          <h2 className="text-base font-medium text-gray-900 mb-3">
            Availability
          </h2>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <p className="text-sm text-gray-600">Available on Contact</p>
          </div>
        </div>
      </div>
    </div>
  );
}
