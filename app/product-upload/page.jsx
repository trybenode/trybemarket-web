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
  onSnapshot, Timestamp
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
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Trash2, Upload, X, Crown, Info } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { canUserUploadProduct } from '../../hooks/UploadLimiter';
import { useSubscription } from "@/hooks/useSubscription";
import { compressImage } from '@/utils/imageCompress';

import Header from "@/components/Header";
export default function SellPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: authLoading } = useUser();
  const { limits, loading: subLoading } = useSubscription(currentUser?.uid);
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
  const [isVip, setIsVip] = useState(false);

  // Check if user can use VIP tags
  const canUseVipTag = limits?.vipTagsProduct > 0;
  const vipTagsAvailable = limits?.vipTagsProduct || 0;


  // Handle authentication and KYC
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        // console.log("No authenticated user, redirecting to login");
        router.push("/login");
      } else if (!currentUser.isVerified) {
        // console.log("User is not verified, showing KYC dialog");
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
        setIsVip(data.isVip || false);
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
    // console.log("Matched category:", matched);
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
      const urls = await Promise.all(
        arr.map(async (file) => {
          const compressed = await compressImage(file);
          const data = new FormData();
          data.append("file", compressed);
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
      const userId = auth.currentUser.uid;
      
      // Check user upload limit with new subscription system
      const uploadCheck = await canUserUploadProduct();
      if (!uploadCheck.canUpload && !isEditMode) {
        toast.error(
          uploadCheck.message || 
          `You have ${uploadCheck.currentCount} of ${uploadCheck.limit} products. Upgrade to add more!`,
          { duration: 5000 }
        );
        // Redirect to subscription page after 2 seconds
        setTimeout(() => router.push('/subscription'), 2000);
        return;
      }
      
      //add university from user collection to product collection
       const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("User not found");
      const userData = userSnap.data();
      const university = userData.selectedUniversity || "Unknown";

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
        originalPrice: parseFloat(originalPrice) || "",
        year: year.trim(),
        images,
        userId,
        university,
        isVip: isVip,
        ...(isEditMode ? { updatedAt: new Date() } : { createdAt: new Date() }),
      };
  
      if (isEditMode) await updateDoc(doc(db, "products", productId), data);
      else {
        await addDoc(collection(db, "products"), data);
        // No need to increment count - we check actual count in Firestore
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
      <div className='flex items-center justify-center min-h-screen bg-white'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2' style={{ borderColor: 'rgb(37,99,235)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl w-full">
        <Header title={isEditMode ? "Edit Product" : "Add New Product"} />

        {/* Hero Section */}
        <div className='mt-8 mb-8'>
          <h1 className='text-2xl md:text-3xl font-semibold text-gray-900 mb-2'>
            {isEditMode ? "Edit your product" : "List a product"}
          </h1>
          <p className='text-gray-600 text-sm'>
            Fill in the details below to {isEditMode ? "update" : "showcase"} your product
          </p>
        </div>

        {/* VIP Alert */}
        {canUseVipTag && (
          <Alert className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
            <Crown className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm text-gray-700">
              <strong className="text-gray-900">VIP Feature Available!</strong> You have{" "}
              <span className="font-semibold" style={{ color: 'rgb(37,99,235)' }}>
                {vipTagsAvailable} VIP tag{vipTagsAvailable !== 1 ? "s" : ""}
              </span>{" "}
              remaining for products. VIP products get featured placement and priority visibility.
            </AlertDescription>
          </Alert>
        )}

      <AlertDialog
        open={openVerificationDialog}
        onOpenChange={setOpenVerificationDialog}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">KYC Verification Required</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              You are not verified. Please complete KYC to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => router.back()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => router.push("/kyc")}
              className="text-white"
              style={{ backgroundColor: 'rgb(37,99,235)' }}
            >
              Complete KYC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* VIP Toggle Section */}
        {canUseVipTag && (
          <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-semibold text-gray-900">Mark as VIP Product</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  VIP products receive featured placement, priority in search results, and a special badge.
                  You have <span className="font-semibold" style={{ color: 'rgb(37,99,235)' }}>{vipTagsAvailable}</span> VIP tag{vipTagsAvailable !== 1 ? "s" : ""} available.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVip(!isVip)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isVip ? 'bg-yellow-500' : 'bg-gray-300'
                }`}
                style={isVip ? {} : {}}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isVip ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isVip && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-800 bg-yellow-100 rounded-md p-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>This product will be marked as VIP and get premium visibility!</span>
              </div>
            )}
          </div>
        )}

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-900">Product Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 pt-6'>
            <div className='space-y-2'>
              <Label htmlFor='productName' className="text-sm font-medium text-gray-900">Product Name</Label>
              <Input
                id='productName'
                placeholder='Enter product name'
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={saving}
                className="border-gray-300 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Select */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium text-gray-900">Category</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger id="category" className="border-gray-300">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {category.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-Category Popover */}
              {availableSubcategories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subCategory" className="text-sm font-medium text-gray-900">Sub-Category</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start border-gray-300"
                      >
                        {selectedSubcategories.length > 0
                          ? selectedSubcategories.join(", ")
                          : "Select sub-categories"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full bg-white">
                      <div className="flex flex-col space-y-2 max-h-48 overflow-y-auto">
                        {availableSubcategories.map((sub) => (
                          <label
                            key={sub}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
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
                            <span className="text-sm text-gray-700">{sub}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className='space-y-2'>
              <Label className="text-sm font-medium text-gray-900">Product Images</Label>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {images.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors"
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
                      className='absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-colors'
                      onClick={() => removeImage(index)}
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <div className='aspect-square flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-gray-50'>
                    <label className='cursor-pointer flex flex-col items-center justify-center w-full h-full'>
                      <Upload className='h-8 w-8 text-gray-400' />
                      <span className='mt-2 text-xs text-gray-500 font-medium'>
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
              <p className='text-xs text-gray-500 flex items-center gap-1'>
                <Info className="h-3 w-3" />
                Upload up to 5 images. First image will be the cover.
              </p>
            </div>

            <div className='flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border border-gray-200'>
              <Checkbox
                id='negotiable'
                checked={isNegotiable}
                onCheckedChange={(checked) => setIsNegotiable(checked === true)}
                disabled={saving}
              />
              <label
                htmlFor='negotiable'
                className='text-sm font-medium text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
              >
                Price is negotiable
              </label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description' className="text-sm font-medium text-gray-900">Product Description</Label>
              <Textarea
                id='description'
                placeholder='Describe your product in details'
                className='min-h-[120px] border-gray-300 focus:border-blue-500'
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-900">Additional Details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 pt-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='brand' className="text-sm font-medium text-gray-900">Brand</Label>
                <Input
                  id='brand'
                  placeholder='Enter brand'
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={saving}
                  className="border-gray-300 focus:border-blue-500"
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='condition' className="text-sm font-medium text-gray-900">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id='condition' className="border-gray-300">
                    <SelectValue placeholder='Select condition' />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
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
                <Label htmlFor='color' className="text-sm font-medium text-gray-900">Color</Label>
                <Input
                  id='color'
                  placeholder='Enter color'
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={saving}
                  className="border-gray-300 focus:border-blue-500"
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='year' className="text-sm font-medium text-gray-900">Year</Label>
                <Input
                  id='year'
                  placeholder='Enter year'
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={saving}
                  className="border-gray-300 focus:border-blue-500"
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='price' className="text-sm font-medium text-gray-900">Price (₦)</Label>
                <Input
                  id='price'
                  type='number'
                  placeholder='Enter price'
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                  className="border-gray-300 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalPrice" className="text-sm font-medium text-gray-900">
                  Original Price (₦) <span className="text-gray-500 font-normal">(Optional)</span>
                </Label>
                <Input
                  id='originalPrice'
                  type='number'
                  placeholder='Enter original price'
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  disabled={saving}
                  className="border-gray-300 focus:border-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!isEditMode && (
          <div className='flex items-center space-x-2 p-4 bg-gray-50 rounded-lg border border-gray-200'>
            <Checkbox
              id='terms'
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(checked === true)}
              disabled={saving}
            />
            <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
              I agree to the Terms & Conditions and confirm this product
              complies with marketplace policies
            </label>
          </div>
        )}

        <div className='flex justify-between items-center pt-4'>
          {isEditMode ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='outline' type='button' disabled={saving} className="border-red-300 text-red-600 hover:bg-red-50">
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete Product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-gray-900">Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-600">
                    This action cannot be undone. This will permanently delete
                    your product from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
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
              className="border-gray-300"
            >
              Cancel
            </Button>
          )}

          <Button 
            type='submit' 
            disabled={saving || (!isEditMode && !isAgreed)}
            className="text-white min-w-[140px]"
            style={{ backgroundColor: 'rgb(37,99,235)' }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = 'rgb(29,78,216)')}
            onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = 'rgb(37,99,235)')}
          >
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
    </div>
  );
}
