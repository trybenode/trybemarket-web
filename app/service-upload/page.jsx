"use client";
import React, { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X } from "lucide-react";

const category = [{ id: 1, label: "cat" }];

export default function ServiceUpload() {
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState("");
  const [images, setImages] = useState([]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto px-4 py-4 max-w-3xl w-full">
        <Header title={"List a Service"} />

        <form className="space-y-4 flex flex-col flex-grow">
          <CardContent className="space-y-4 mt-6">
            <Input
              id="Service Name"
              placeholder="Service Brand Name"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)} // ✅ fixed
            />

            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {category.map((cat) => (
                  <SelectItem key={cat.id} value={cat.label}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              id="description"
              placeholder="Describe your service in detail"
              className="min-h-[120px]"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
            />

            <Input
              id="Price"
              type="number"
              placeholder="Base price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <Select
              value={selectedAvailability}
              onValueChange={setSelectedAvailability}
            >
              <SelectTrigger id="availability">
                <SelectValue placeholder="Select Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Available</SelectItem>
                <SelectItem value="false">Not Available</SelectItem>
              </SelectContent>
            </Select>

            <div className="aspect-square flex items-center justify-center border border-dashed border-gray-300 rounded-md w-full py-4 h-40">
              <label className="cursor-pointer flex flex-col items-center justify-center py-4">
                <span className="text-center mb-2 text-sm text-gray-500">
                  <h4 className="text-black font-semibold">Upload Image</h4>
                  Showcase your service with high quality images
                </span>
                <button
                  type="button"
                  className="text-sm bg-gray-200 text-black rounded-md px-4 py-2"
                >
                  Add Images
                </button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  // onChange={handleImageUpload}
                  multiple={images.length === 0}
                />
              </label>
            </div>
          </CardContent>
        </form>
      </div>

    
      <div className="w-full mt-4 py-4 px-4">
        <div className="max-w-3xl mx-auto flex justify-center">
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-md px-6 py-3 hover:bg-blue-600 transition"
          >
            Add Service
          </button>
        </div>
      </div>
    </div>
  );
}

// File: components/forms/ProductForm.jsx
// 'use client';

// import React from 'react';
// import ProductImageUploader from './ProductImageUploader';
// import ProductCategorySelector from './ProductCategorySelector';
// import ProductDetailsSection from './ProductDetailsSection';
// import ProductAdditionalInfo from './ProductAdditionalInfo';
// import TermsAgreement from './TermsAgreement';
// import SubmitButtons from './SubmitButtons';

// export default function ProductForm(props) {
//   return (
//     <form onSubmit={props.handleSubmit} className='space-y-8'>
//       <ProductDetailsSection {...props} />
//       <ProductCategorySelector {...props} />
//       <ProductImageUploader {...props} />
//       <ProductAdditionalInfo {...props} />
//       {!props.isEditMode && <TermsAgreement {...props} />}
//       <SubmitButtons {...props} />
//     </form>
//   );
// }
