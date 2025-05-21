"use client"


import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { collection, getDoc, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, Trash2, Upload, X } from "lucide-react"

// Sample categories - replace with your actual categories
const categories = [
  { id: "electronics", name: "Electronics" },
  { id: "clothing", name: "Clothing" },
  { id: "books", name: "Books" },
  { id: "furniture", name: "Furniture" },
  { id: "sports", name: "Sports" },
  { id: "toys", name: "Toys" },
  { id: "beauty", name: "Beauty" },
  { id: "automotive", name: "Automotive" },
]

export default function SellPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get("id")
  const isEditMode = !!productId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<any>(null)

  // Form state
  const [productName, setProductName] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [images, setImages] = useState([])
  const [isNegotiable, setIsNegotiable] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)
  const [productDescription, setProductDescription] = useState("")
  const [brand, setBrand] = useState("")
  const [condition, setCondition] = useState("")
  const [color, setColor] = useState("")
  const [price, setPrice] = useState("")
  const [originalPrice, setOriginalPrice] = useState("")
  const [year, setYear] = useState("")

  // Check if user is authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [router])

  // Fetch product data if in edit mode
  useEffect(() => {
    const fetchProduct = async () => {
      if (isEditMode && productId) {
        try {
          const productDoc = await getDoc(doc(db, "products", productId))

          if (productDoc.exists()) {
            const productData = productDoc.data()
            setProduct(productData)

            // Populate form fields
            setProductName(productData.name || "")
            setSelectedCategory(productData.categoryId || "")
            setSubCategory(productData.subcategory || "")
            setIsNegotiable(productData.negotiable || false)
            setProductDescription(productData.description || "")
            setBrand(productData.brand || "")
            setCondition(productData.condition || "")
            setColor(productData.color || "")
            setPrice(productData.price?.toString() || "")
            setOriginalPrice(productData.originalPrice?.toString() || "")
            setYear(productData.year || "")
            setImages(Array.isArray(productData.images) ? productData.images : [])
          } else {
            toast({
              title: "Product not found",
              description: "The product you're trying to edit doesn't exist.",
              variant: "destructive",
            })
            router.push("/my-shop")
          }
        } catch (error) {
          console.error("Error fetching product:", error)
          toast({
            title: "Error",
            description: "Failed to load product data. Please try again.",
            variant: "destructive",
          })
        }
      }

      setLoading(false)
    }

    fetchProduct()
  }, [isEditMode, productId, router])

  const handleImageUpload = () => {
    const files = e.target.files

    if (!files || files.length === 0) return

    // This is a placeholder for actual image upload
    // In a real implementation, you would upload to a storage service like Firebase Storage

    // For demo purposes, we'll use local URLs
    const newImages = Array.from(files).map((file) => URL.createObjectURL(file))
    setImages([...images, ...newImages])

    // Reset the input
    e.target.value = ""
  }

  const removeImage = (index) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
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
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and upload at least one image.",
        variant: "destructive",
      })
      return
    }

    if (!isEditMode && !isAgreed) {
      toast({
        title: "Terms & Conditions",
        description: "Please agree to the terms and conditions to continue.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      // Check authentication
      if (!auth.currentUser) {
        throw new Error("User not authenticated")
      }

      // Prepare product data
      const productData = {
        name: productName.trim(),
        subcategory: subCategory.trim(),
        categoryId: selectedCategory,
        negotiable: isNegotiable,
        description: productDescription.trim(),
        brand: brand.trim(),
        condition: condition.trim(),
        color: color.trim(),
        price: Number.parseFloat(price) || 0,
        originalPrice: Number.parseFloat(originalPrice) || 0,
        year: year.trim(),
        images: images,
        userId: auth.currentUser.uid,
        ...(isEditMode ? { updatedAt: new Date() } : { createdAt: new Date() }),
      }

      // Create or update product
      if (isEditMode && productId) {
        await updateDoc(doc(db, "products", productId), productData)
        toast({
          title: "Success",
          description: "Product updated successfully",
        })
      } else {
        await addDoc(collection(db, "products"), productData)
        toast({
          title: "Success",
          description: "Product uploaded successfully",
        })
      }

      router.push("/my-shop")
    } catch (error) {
      console.error("Failed to save product:", error)
      toast({
        title: "Error",
        description: `Failed to save product: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEditMode || !productId) return

    try {
      setSaving(true)
      await deleteDoc(doc(db, "products", productId))

      toast({
        title: "Success",
        description: "Product deleted successfully",
      })

      router.push("/my-shop")
    } catch (error) {
      console.error("Failed to delete product:", error)
      toast({
        title: "Error",
        description: `Failed to delete product: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="p-0 mr-2" onClick={() => router.back()}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">{isEditMode ? "Edit Product" : "Add New Product"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                placeholder="Enter product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subCategory">Sub-Category</Label>
                <Input
                  id="subCategory"
                  placeholder="Enter sub-category"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Product Images</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-gray-200">
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`Product image ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <div className="aspect-square flex items-center justify-center border border-dashed border-gray-300 rounded-md">
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Add Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        multiple={images.length === 0}
                        disabled={saving}
                      />
                    </label>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Upload up to 5 images. First image will be the cover.</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="negotiable"
                checked={isNegotiable}
                onCheckedChange={(checked) => setIsNegotiable(checked === true)}
                disabled={saving}
              />
              <label
                htmlFor="negotiable"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Price is negotiable
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Product Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your product in detail"
                className="min-h-[120px]"
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  placeholder="Enter brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id="condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like-new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Enter color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  placeholder="Enter year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (₦)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="Enter price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalPrice">Original Price (₦) (Optional)</Label>
                <Input
                  id="originalPrice"
                  type="number"
                  placeholder="Enter original price"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!isEditMode && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(checked === true)}
              disabled={saving}
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              I agree to the Terms & Conditions and confirm this product complies with marketplace policies
            </label>
          </div>
        )}

        <div className="flex justify-between">
          {isEditMode ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" disabled={saving}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your product from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" type="button" onClick={() => router.back()} disabled={saving}>
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={saving || (!isEditMode && !isAgreed)}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEditMode ? "Updating..." : "Uploading..."}
              </>
            ) : (
              <>{isEditMode ? "Update Product" : "Add Product"}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
