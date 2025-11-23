"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardContent } from "@/components/ui/card";
import { Upload, X, Crown, Info } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useServiceForm } from "@/hooks/useServiceForm";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ServiceUpload() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser();
  const form = useServiceForm(currentUser);
  const { limits, loading: subLoading } = useSubscription(currentUser?.uid);
  const [isVip, setIsVip] = useState(false);

  // Check if user can use VIP tags
  const canUseVipTag = limits?.vipTagsService > 0;
  const vipTagsAvailable = limits?.vipTagsService || 0;

  if (authLoading || form.isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    );
  }

  return (
    <div className='flex flex-col min-h-screen bg-white'>
      <div className='container mx-auto px-4 py-6 max-w-4xl w-full'>
        <Header title={"List a Service"} />

        {/* Hero Section */}
        <div className='mt-8 mb-8'>
          <h1 className='text-2xl md:text-3xl font-semibold text-gray-900 mb-2'>
            Create a service listing
          </h1>
          <p className='text-gray-600 text-sm'>
            Fill in the details below to showcase your service
          </p>
        </div>

        {/* VIP Info Alert */}
        {canUseVipTag && (
          <Alert className='mb-6 border-[rgb(37,99,235)] bg-blue-50'>
            <Crown className='h-4 w-4 text-[rgb(37,99,235)]' />
            <AlertDescription className='text-sm text-gray-700'>
              You have <strong>{vipTagsAvailable} VIP tags</strong> available. Mark services as VIP for priority visibility.
            </AlertDescription>
          </Alert>
        )}

        <form
          className='space-y-6 flex flex-col flex-grow'
          onSubmit={(e) => {
            e.preventDefault();
            // Pass isVip to the form handler
            form.handleSubmit(e, isVip);
          }}
        >
          <div className='space-y-6'>
            {/* Service Name */}
            <div>
              <label className='block text-sm font-medium text-gray-900 mb-2'>
                Service name <span className='text-red-500'>*</span>
              </label>
              <Input
                placeholder='e.g., Professional Photography'
                value={form.serviceName}
                onChange={(e) => form.setServiceName(e.target.value)}
                disabled={form.saving}
                className='border-gray-300 focus:border-[rgb(37,99,235)]'
              />
            </div>

            {/* Category */}
            <div>
              <label className='block text-sm font-medium text-gray-900 mb-2'>
                Category <span className='text-red-500'>*</span>
              </label>
              <Select
                value={form.selectedCategory}
                onValueChange={form.setSelectedCategory}
              >
                <SelectTrigger className='border-gray-300 focus:border-[rgb(37,99,235)]'>
                  <SelectValue placeholder='Select a category' />
                </SelectTrigger>
                <SelectContent>
                  {form.category.map((cat) => (
                    <SelectItem key={cat.label} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className='block text-sm font-medium text-gray-900 mb-2'>
                Description <span className='text-red-500'>*</span>
              </label>
              <Textarea
                placeholder='Describe your service in detail, what you offer, and what makes you unique...'
                className='min-h-[140px] border-gray-300 focus:border-[rgb(37,99,235)] resize-none'
                value={form.serviceDescription}
                onChange={(e) => form.setServiceDescription(e.target.value)}
                disabled={form.saving}
              />
              <p className='text-xs text-gray-500 mt-1'>
                Be specific about what customers can expect
              </p>
            </div>

            {/* Price */}
            <div>
              <label className='block text-sm font-medium text-gray-900 mb-2'>
                Base price <span className='text-red-500'>*</span>
              </label>
              <div className='relative'>
                <span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500'>₦</span>
                <Input
                  type='number'
                  placeholder='0.00'
                  value={form.price}
                  onChange={(e) => form.setPrice(e.target.value)}
                  disabled={form.saving}
                  className='pl-8 border-gray-300 focus:border-[rgb(37,99,235)]'
                />
              </div>
            </div>

            {/* Availability */}
            <div className='space-y-3'>
              <label className='block text-sm font-medium text-gray-900'>
                Availability <span className='text-red-500'>*</span>
              </label>
              <Select
                value={form.availabilityType}
                onValueChange={form.setAvailabilityType}
                disabled={form.saving}
              >
                <SelectTrigger className='border-gray-300 focus:border-[rgb(37,99,235)]'>
                  <SelectValue placeholder='Select availability type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='on_contact'>
                    Available on Contact
                  </SelectItem>
                  <SelectItem value='specific_time'>
                    Specific Timeframe
                  </SelectItem>
                </SelectContent>
              </Select>

              {form.availabilityType === "specific_time" && (
                <div className='grid grid-cols-2 gap-4 pt-2'>
                  <div>
                    <label className='block text-xs text-gray-600 mb-1.5'>Start time</label>
                    <Input
                      type='time'
                      value={form.availabilityStart}
                      onChange={(e) => form.setAvailabilityStart(e.target.value)}
                      disabled={form.saving}
                      className='border-gray-300 focus:border-[rgb(37,99,235)]'
                    />
                  </div>
                  <div>
                    <label className='block text-xs text-gray-600 mb-1.5'>End time</label>
                    <Input
                      type='time'
                      value={form.availabilityEnd}
                      onChange={(e) => form.setAvailabilityEnd(e.target.value)}
                      disabled={form.saving}
                      className='border-gray-300 focus:border-[rgb(37,99,235)]'
                    />
                  </div>
                </div>
              )}
            </div>

            {/* VIP Toggle */}
            {canUseVipTag && (
              <div className='p-4 border border-gray-200 rounded-lg bg-gray-50'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-3'>
                    <Crown className='h-5 w-5 text-[rgb(37,99,235)] mt-0.5' />
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-1'>
                        Mark as VIP Service
                      </h4>
                      <p className='text-xs text-gray-600'>
                        Get priority placement in search results and featured sections
                      </p>
                      <p className='text-xs text-gray-500 mt-1'>
                        {vipTagsAvailable} VIP {vipTagsAvailable === 1 ? 'tag' : 'tags'} available
                      </p>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={() => setIsVip(!isVip)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isVip ? 'bg-[rgb(37,99,235)]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isVip ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Images */}
            <div>
              <label className='block text-sm font-medium text-gray-900 mb-2'>
                Images <span className='text-red-500'>*</span>
              </label>
              <p className='text-xs text-gray-500 mb-3'>
                Upload up to 5 high-quality images showcasing your service
              </p>
              
              <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                {form.images.map((image, index) => (
                  <div
                    key={index}
                    className='relative aspect-square rounded-lg overflow-hidden border border-gray-200 group'
                  >
                    <img
                      src={image}
                      alt={`Service ${index + 1}`}
                      className='object-cover w-full h-full'
                    />
                    <button
                      type='button'
                      className='absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity'
                      onClick={() =>
                        form.setImages((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </div>
                ))}
                
                {form.images.length < 5 && (
                  <label className='aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-[rgb(37,99,235)] hover:bg-gray-50 cursor-pointer transition-colors'>
                    <Upload className='h-8 w-8 text-gray-400 mb-2' />
                    <span className='text-sm font-medium text-gray-700'>Add image</span>
                    <span className='text-xs text-gray-500 mt-1'>PNG, JPG up to 10MB</span>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={form.handleImageUpload}
                      multiple={form.images.length === 0}
                      disabled={form.saving}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className='flex items-center justify-between pt-6 pb-8 border-t border-gray-200'>
            <button
              type='button'
              onClick={() => router.back()}
              className='px-6 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors'
              disabled={form.saving}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='px-8 py-2.5 bg-[rgb(37,99,235)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              disabled={form.saving}
            >
              {form.saving ? 'Publishing...' : 'Publish Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
