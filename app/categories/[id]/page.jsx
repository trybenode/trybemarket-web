"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore'
import { PackageSearch, RotateCw } from 'lucide-react'
import { db } from '@/lib/firebase'
import Header from '@/components/Header'
import ListingCards from '@/components/ListingCards'
import ListingCardSkeleton from '@/components/ui/ListingCardSkeleton'
import { Button } from '@/components/ui/button'

const PAGE_LIMIT = 10

export default function CategoryProductList() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  // The route folder is [id]. This used to read params.categoryId, which never
  // exists, so the category name could only ever come from the ?categoryName=
  // query string: a link without it (shared, bookmarked, opened directly) showed
  // a generic "Category" title and "No products found".
  const categoryId = params?.id
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
          setLoading(false)
        }
      } catch (err) {
        setError('Failed to load category')
        setLoading(false)
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

      // Ranking: rankScore desc (tier + VIP + boost, computed server-side —
      // see 07-ranking-unification.md), createdAt desc as a deterministic
      // tiebreaker. No client-side sort needed anymore.
      const q = query(
        collection(db, 'products'),
        where('categoryId', '==', categoryName),
        orderBy('rankScore', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_LIMIT)
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
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title={categoryName || 'Category'} />

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        {!loading && !error && products.length > 0 && (
          <p className="text-sm text-slate-500">
            {products.length >= PAGE_LIMIT ? (
              <>Showing the top <span className="font-semibold text-slate-900">{PAGE_LIMIT}</span> in {categoryName}</>
            ) : (
              <>
                <span className="font-semibold text-slate-900">{products.length}</span>{' '}
                {products.length === 1 ? 'item' : 'items'} in {categoryName}
              </>
            )}
          </p>
        )}

        {loading ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-800">{error}</p>
            <div className="mt-5 flex gap-2">
              {categoryName && (
                <Button variant="soft" onClick={fetchProducts}>
                  <RotateCw /> Try again
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push('/')}>
                Back to marketplace
              </Button>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <PackageSearch className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Nothing here yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              There are no products in {categoryName || 'this category'} right now. Check back soon, or be the first to list one.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => router.push('/upload')}>List a product</Button>
              <Button variant="outline" onClick={() => router.push('/')}>
                Browse everything
              </Button>
            </div>
          </div>
        ) : (
          <ListingCards products={products} refreshControl={fetchProducts} />
        )}
      </div>
    </div>
  )
}
