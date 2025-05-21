"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { collection, query, where, getDocs } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, RefreshCw } from "lucide-react"
import ListingCard from "@/components/ListingCard"

export default function MyShopPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [userProducts, setUserProducts] = useState([])
  const [activeTab, setActiveTab] = useState("products")

  // Check if user is authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [router])

  // Fetch user profile and products
  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = auth.currentUser

        if (currentUser) {
          // Fetch user profile
          const userDoc = await getDocs(query(collection(db, "users"), where("userId", "==", currentUser.uid)))

          if (!userDoc.empty) {
            setUserProfile(userDoc.docs[0].data())
          }

          // Fetch user products
          const productQuery = query(collection(db, "products"), where("userId", "==", currentUser.uid))

          const productDocs = await getDocs(productQuery)
          const products = productDocs.docs.map((doc) => ({
            id: doc.id,
            product: {
              ...doc.data(),
              id: doc.id,
            },
          }))

          setUserProducts(products)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    }

    fetchData()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      const currentUser = auth.currentUser

      if (currentUser) {
        // Fetch user products
        const productQuery = query(collection(db, "products"), where("userId", "==", currentUser.uid))

        const productDocs = await getDocs(productQuery)
        const products = productDocs.docs.map((doc) => ({
          id: doc.id,
          product: {
            ...doc.data(),
            id: doc.id,
          },
        }))

        setUserProducts(products)
      }
    } catch (error) {
      console.error("Error refreshing data:", error)
    } finally {
      setRefreshing(false)
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Shop</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => router.push("/sell")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden">
              <Image
                src={userProfile?.profilePicture || "/placeholder.svg?height=96&width=96"}
                alt="Profile"
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold">{userProfile?.fullName || "Your Shop"}</h2>
              <p className="text-gray-500">
                Member since {new Date(userProfile?.createdAt || Date.now()).getFullYear()}
              </p>
              <p className="text-gray-500">{userProfile?.address || "No address provided"}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => router.push("/settings")}>
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="products">My Products</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {userProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {userProducts.map((item) => (
                <div key={item.id} className="cursor-pointer" onClick={() => router.push(`/sell?id=${item.id}`)}>
                  <ListingCard product={item.product} btnName="Edit" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-lg text-gray-500 mb-4">You haven't uploaded any products yet.</p>
              <Button onClick={() => router.push("/sell")}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Product
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sales">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-lg text-gray-500">No sales history yet.</p>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-lg text-gray-500">No purchase history yet.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
