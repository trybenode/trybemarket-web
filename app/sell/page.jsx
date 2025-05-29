"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";
import { db,auth} from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";;
import { ChevronLeft, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";;
import UserProfile from "@/components/UserProfile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {canUserUpload,  incrementUploadCount } from '../../hooks/UploadLimiter'

export default function SellPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: authLoading } = useUser();
  const productId = searchParams.get("id");
  const isEditMode = Boolean(productId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openVerificationDialog, setOpenVerificationDialog] = useState(false);
  const [product, setProduct] = useState(null);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState([])
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [images, setImages] = useState([]);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [productDescription, setProductDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [year, setYear] = useState("");
  const [availableSubcategories, setAvailableSubcategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);


  // Handle authentication and KYC
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        console.log("No authenticated user, redirecting to login");
        router.push("/login");
      } else if (!currentUser.isVerified) {
        console.log("User is not verified, showing KYC dialog");
        setOpenVerificationDialog(true);
      }
      setLoading(false);
    }
  }, [currentUser, authLoading, router]);

  //fetchCategory and sub
  useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
    const categoryData = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        label: data.name,
        value: data.name, 
        subCategories: data.subcategories || [],
      };
    });
    setCategory(categoryData);
  });

  return () => unsubscribe();
}, []);

  // Fetch product data if editing
  useEffect(() => {
    const fetchProduct = async () => {
      if (!isEditMode || !currentUser) {
        setLoading(false);
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, "products", productId));
        if (!docSnap.exists()) {
          toast.error("Product not found");
          router.push("/my-shop");
          return;
        }
        const data = docSnap.data();
        setProduct(data);
        setProductName(data.name || "");
        setSelectedCategory(data.categoryId || "");
        setSubCategory(data.subcategory || []);
        setIsNegotiable(data.negotiable || false);
        setProductDescription(data.description || "");
        setBrand(data.brand || "");
        setCondition(data.condition || "");
        setColor(data.color || "");
        setPrice(data.price?.toString() || "");
        setOriginalPrice(data.originalPrice?.toString() || "");
        setYear(data.year || "");
        setImages(Array.isArray(data.images) ? data.images : []);
      } catch (err) {
        console.error("Error fetching product:", err);
        toast.error("Failed to load product");
        router.push("/my-shop");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [isEditMode, productId, currentUser, router]);

  // Clear form on unmount
  const clearForm = useCallback(() => {
    setProductName("");
    setSubCategory([]);
    setSelectedCategory("");
    setIsNegotiable(false);
    setProductDescription("");
    setBrand("");
    setCondition("");
    setColor("");
    setPrice("");
    setOriginalPrice("");
    setYear("");
    setImages([]);
    setIsAgreed(false);
  }, []);

  useEffect(() => {
    return () => clearForm();
  }, [clearForm]);


//map categories and sub categories 
  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    const matched = category.find((cat) => cat.label === value);
    console.log("Matched category:", matched);
    setAvailableSubcategories(matched?.subCategories || []);
    setSelectedSubcategories([]);
  };
  // Warn on unsaved changes
  const arraysAreEqual = (a, b) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  const hasUnsaved = useCallback(() => {
    if (!isEditMode)
      return (
        productName ||
        price ||
        selectedCategory ||
        productDescription ||
        brand ||
        condition ||
        color ||
        year ||
        images.length
      );
    return (
      productName !== product?.name ||
      price !== product?.price?.toString() ||
      selectedCategory !== product?.categoryId ||
      subCategory !== product?.subcategory ||
      isNegotiable !== product?.negotiable ||
      productDescription !== product?.description ||
      brand !== product?.brand ||
      condition !== product?.condition ||
      color !== product?.color ||
      originalPrice !== product?.originalPrice?.toString() ||
      year !== product?.year ||
      !arraysAreEqual(images, product?.images || [])
    );
  }, [
    isEditMode,
    product,
    productName,
    price,
    selectedCategory,
    subCategory,
    isNegotiable,
    productDescription,
    brand,
    condition,
    color,
    originalPrice,
    year,
    images,
  ]);

  useEffect(() => {
    const handleBefore = (e) => {
      if (hasUnsaved()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBefore);
    return () => window.removeEventListener("beforeunload", handleBefore);
  }, [hasUnsaved]);



  // Image handlers
  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const arr = Array.from(files)
    try {
      // const urls = await Promise.all(
      //   arr.map(async (file) => {
      //     const data = new FormData();
      //     data.append("file", file);
      //     data.append("upload_preset", "ProductImage");
      //     data.append("cloud_name", "dj21x4jnt");
      //     data.append("folder", "market_trybe_products");
      //     const res = await fetch(
      //       "https://api.cloudinary.com/v1_1/dj21x4jnt/image/upload",
      //       { method: "POST", body: data }
      //     );
      //     const json = await res.json();
      //     if (!json.secure_url) throw new Error("Upload failed");
      //     return json.secure_url;
      //   })
      // );
      // setImages((prev) => [...prev, ...urls]);
      const urls = await Promise.all(
        arr.map(async (file) => {
          const data = new FormData();
          data.append("file", file);
          data.append("upload_preset", "ProductImage");
          data.append("cloud_name", "dj21x4jnt");
          data.append("folder", "market_trybe_products");
          const res = await fetch(
            "https://api.cloudinary.com/v1_1/dj21x4jnt/image/upload",
            { method: "POST", body: data }
          );
          const json = await res.json();
          if (!json.secure_url) throw new Error("Upload failed");
          return json.secure_url;
        })
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error(err.message);
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !productName ||
      !selectedCategory ||
      !productDescription ||
      !brand ||
      !condition ||
      !color ||
      !price ||
      !year ||
      images.length === 0
    ) {
      toast.error("Fill all fields & add images");
      return;
    }
    if (!isEditMode && !isAgreed) {
      toast.error("Agree to terms");
      return;
    }
    try {
      setSaving(true);
      if (!auth.currentUser) throw new Error("Not authenticated");

      // Check user upload limit
      console.log('Checking if user can upload for UID:', auth.currentUser.uid);
      const canUpload = await canUserUpload();
      // console.log('Can upload:', canUpload);
      if (!canUpload) {
        toast.error(
            'You have reached your monthly upload limit. Upgrade to premium to upload more products.',
        );
        return;
      }

      const data = {
        name: productName.trim(),
        subcategory: selectedSubcategories,
        categoryId: selectedCategory,
        negotiable: isNegotiable,
        description: productDescription.trim(),
        brand: brand.trim(),
        condition,
        color,
        price: parseFloat(price) || 0,
        originalPrice: parseFloat(originalPrice) || 0,
        year: year.trim(),
        images,
        userId: currentUser.uid,
        ...(isEditMode ? { updatedAt: new Date() } : { createdAt: new Date() }),
      };
  
      if (isEditMode) await updateDoc(doc(db, "products", productId), data);
      else {
        await addDoc(collection(db, "products"), data);
        await incrementUploadCount();
      }    
      toast.success(isEditMode ? "Updated" : "Uploaded");
      router.push("/my-shop");
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!isEditMode) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, "products", productId));
      toast.success("Product removed");
      router.push("/my-shop");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    );;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center mb-6 justify-between">
        <Button
          variant="ghost"
          className="p-0 mr-2"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Product" : "Add New Product"}
        </h1>
        <UserProfile />
      </div>

      <AlertDialog
        open={openVerificationDialog}
        onOpenChange={setOpenVerificationDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>KYC Verification Required</AlertDialogTitle>
            <AlertDialogDescription>
              You are not verified. Please complete KYC to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => router.back()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/kyc")}>
              Complete KYC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <form onSubmit={handleSubmit} className='space-y-8'>
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='productName'>Product Name</Label>
              <Input
                id='productName'
                placeholder='Enter product name'
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Select */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {category.map((cat) => (
                      <SelectItem key={cat.label} value={cat.label}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-Category Popover */}
              {availableSubcategories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subCategory">Sub-Category</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        {selectedSubcategories.length > 0
                          ? selectedSubcategories.join(", ")
                          : "Select sub-categories"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full">
                      <div className="flex flex-col space-y-2 max-h-48 overflow-y-auto">
                        {availableSubcategories.map((sub) => (
                          <label
                            key={sub}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedSubcategories.includes(sub)}
                              onCheckedChange={(checked) => {
                                setSelectedSubcategories((prev) =>
                                  checked
                                    ? [...prev, sub]
                                    : prev.filter((s) => s !== sub)
                                );
                              }}
                            />
                            <span className="text-sm">{sub}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className='space-y-2'>
              <Label>Product Images</Label>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {images.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-md overflow-hidden border border-gray-200"
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`Product image ${index + 1}`}
                      fill
                      className='object-cover'
                      sizes='(max-width: 768px) 50vw, 25vw'
                    />
                    <button
                      type='button'
                      className='absolute top-1 right-1 bg-red-500 text-white rounded-full p-1'
                      onClick={() => removeImage(index)}
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <div className='aspect-square flex items-center justify-center border border-dashed border-gray-300 rounded-md'>
                    <label className='cursor-pointer flex flex-col items-center justify-center w-full h-full'>
                      <Upload className='h-8 w-8 text-gray-400' />
                      <span className='mt-2 text-sm text-gray-500'>
                        Add Image
                      </span>
                      <input
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={handleImageUpload}
                        multiple={images.length === 0}
                        disabled={saving}
                      />
                    </label>
                  </div>
                )}
              </div>
              <p className='text-xs text-gray-500'>
                Upload up to 5 images. First image will be the cover.
              </p>
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox
                id='negotiable'
                checked={isNegotiable}
                onCheckedChange={(checked) => setIsNegotiable(checked === true)}
                disabled={saving}
              />
              <label
                htmlFor='negotiable'
                className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
              >
                Price is negotiable
              </label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Product Description</Label>
              <Textarea
                id='description'
                placeholder='Describe your product in details'
                className='min-h-[120px]'
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='brand'>Brand</Label>
                <Input
                  id='brand'
                  placeholder='Enter brand'
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='condition'>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id='condition'>
                    <SelectValue placeholder='Select condition' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='new'>New</SelectItem>
                    <SelectItem value='like-new'>Like New</SelectItem>
                    <SelectItem value='used'>Used</SelectItem>
                    <SelectItem value='good'>Good</SelectItem>
                    <SelectItem value='fair'>Fair</SelectItem>
                    <SelectItem value='poor'>Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='color'>Color</Label>
                <Input
                  id='color'
                  placeholder='Enter color'
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='year'>Year</Label>
                <Input
                  id='year'
                  placeholder='Enter year'
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='price'>Price (₦)</Label>
                <Input
                  id='price'
                  type='number'
                  placeholder='Enter price'
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalPrice">
                  Original Price (₦) (Optional)
                </Label>
                <Input
                  id='originalPrice'
                  type='number'
                  placeholder='Enter original price'
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!isEditMode && (
          <div className='flex items-center space-x-2'>
            <Checkbox
              id='terms'
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(checked === true)}
              disabled={saving}
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              I agree to the Terms & Conditions and confirm this product
              complies with marketplace policies
            </label>
          </div>
        )}

        <div className='flex justify-between'>
          {isEditMode ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='destructive' type='button' disabled={saving}>
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete Product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    your product from our servers.
                    This action cannot be undone. This will permanently delete
                    your product from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
          )}

          <Button type='submit' disabled={saving || (!isEditMode && !isAgreed)}>
            {saving ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                {isEditMode ? "Updating..." : "Uploading..."}
              </>
            ) : (
              <>{isEditMode ? "Update Product" : "Add Product"}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
