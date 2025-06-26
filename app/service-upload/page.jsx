"use client";
import React from "react";
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
import { Upload, X } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useServiceForm } from "@/hooks/useServiceForm";

export default function ServiceUpload() {
  const { currentUser, loading: authLoading } = useUser();
  const form = useServiceForm(currentUser);

  if (authLoading || form.isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    );
  }

  return (
    <div className='flex flex-col min-h-screen'>
      <div className='container mx-auto px-4  max-w-3xl w-full'>
        <Header title={"List a Service"} />

        <form
          className='space-y-4 flex flex-col flex-grow'
          onSubmit={form.handleSubmit}
        >
          <CardContent className='space-y-4 mt-6'>
            <Input
              id='Service Name'
              placeholder='Service Brand Name'
              value={form.serviceName}
              onChange={(e) => form.setServiceName(e.target.value)}
              disabled={form.saving}
            />

            <Select
              value={form.selectedCategory}
              onValueChange={form.setSelectedCategory}
            >
              <SelectTrigger id='category'>
                <SelectValue placeholder='Select Category' />
              </SelectTrigger>
              <SelectContent>
                {form.category.map((cat) => (
                  <SelectItem key={cat.label} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              id='description'
              placeholder='Describe your service in detail'
              className='min-h-[120px]'
              value={form.serviceDescription}
              onChange={(e) => form.setServiceDescription(e.target.value)}
              disabled={form.saving}
            />

            <Input
              id='Price'
              type='number'
              placeholder='Base price'
              value={form.price}
              onChange={(e) => form.setPrice(e.target.value)}
              disabled={form.saving}
            />

            <div className='space-y-2'>
              <Select
                value={form.availabilityType}
                onValueChange={form.setAvailabilityType}
                disabled={form.saving}
              >
                <SelectTrigger id='availability-type'>
                  <SelectValue placeholder='Select Availability Type' />
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
                <div className='grid grid-cols-2 gap-4'>
                  <Input
                    id='start-time'
                    type='time'
                    placeholder='Start Time (e.g., 14:30)'
                    value={form.availabilityStart}
                    onChange={(e) => form.setAvailabilityStart(e.target.value)}
                    disabled={form.saving}
                    className='w-full'
                  />
                  <Input
                    id='end-time'
                    type='time'
                    placeholder='End Time (e.g., 16:30)'
                    value={form.availabilityEnd}
                    onChange={(e) => form.setAvailabilityEnd(e.target.value)}
                    disabled={form.saving}
                    className='w-full'
                  />
                </div>
              )}
            </div>

            <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
              {form.images.map((image, index) => (
                <div
                  key={index}
                  className='relative aspect-square rounded-md overflow-hidden border'
                >
                  <img
                    src={image}
                    alt={`Uploaded ${index}`}
                    className='object-cover w-full h-full'
                  />
                  <button
                    type='button'
                    className='absolute top-1 right-1 bg-red-500 text-white rounded-full p-1'
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
                <div className='aspect-square flex items-center justify-center border border-dashed border-gray-300 rounded-md w-full py-4 h-40'>
                  <label className='cursor-pointer flex flex-col items-center justify-center py-4'>
                    <span className='text-center mb-2 text-sm text-gray-500'>
                      <h4 className='text-black font-semibold'>Upload Image</h4>
                      Showcase your service with high quality images
                    </span>
                    <span className='text-sm bg-gray-200 text-black rounded-md px-4 py-2'>
                      Add Images
                    </span>
                    <input
                      id='service-image'
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={form.handleImageUpload}
                      multiple={form.images.length === 0}
                      disabled={form.saving}
                    />
                  </label>
                </div>
              )}
            </div>
          </CardContent>
          <div className='w-full mt-4 py-4 px-4'>
            <div className='max-w-3xl mx-auto flex justify-center'>
              <button
                type='submit'
                className='bg-blue-500 text-white rounded-md px-6 py-3 hover:bg-blue-600 transition'
                disabled={form.saving}
              >
                Add Service
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
