"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import ListingCards from '@/components/ListingCards'
import UserProfile from '@/components/UserProfile'
import Skeleton from '@/components/ui/skeleton'
import { Loader } from 'lucide-react'
import  BackBtn from '@/components/BackButton'
export default function CategoryProductList() {
  const params = useParams()
  const searchParams = useSearchParams()
  const categoryId = params?.categoryId
  const initialCategoryName = searchParams.get('categoryName')

  const [categoryName, setCategoryName] = useState(initialCategoryName || '')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCategoryName(initialCategoryName || '')
    setProducts([])
    setLoading(true)
    setError(null)
  }, [initialCategoryName, categoryId])

  useEffect(() => {
    const fetchCategoryName = async () => {
      if (categoryName || !categoryId) return

      try {
        const categoryRef = doc(db, 'categories', categoryId)
        const categorySnap = await getDoc(categoryRef)
        if (categorySnap.exists()) {
          setCategoryName(categorySnap.data().name)
        } else {
          setError('Category not found')
        }
      } catch (err) {
        setError('Failed to load category')
        console.error(err)
      }
    }

    fetchCategoryName()
  }, [categoryId, categoryName])

  const fetchProducts = async () => {
    try {
      if (!categoryName) return

      setLoading(true)
      setError(null)

      const q = query(
        collection(db, 'products'),
        where('categoryId', '==', categoryName),
        orderBy('createdAt', 'desc'),
        limit(10)
      )

      const snapshot = await getDocs(q)
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        product: {
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        },
      }))

      setProducts(productsData)
    } catch (err) {
      setError('Failed to load products')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [categoryName])

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
           <BackBtn />
          <h1 className="text-xl font-semibold">{categoryName || 'Category'}</h1>
          <UserProfile />
        </div>
        {loading ? (
          <Loader />
        ) : error ? (
          <p className="mt-4 text-center text-red-500">{error}</p>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-500">No products found in this category</p>
        ) : (
          <ListingCards products={products} />
        )}
      </div>
    </div>
  )
}
