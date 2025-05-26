import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ListingCard from "./ListingCard";
import { db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import Image from "next/image";

export default function SellerDetailsAndRelatedProducts({
  productId,
  product,
}) {
  const router = useRouter();
  const [sellerInfo, setSellerInfo] = useState(null);
  const [sellerProducts, setSellersProducts] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!productId) {
        setError("Product ID is missing");
        setLoading(false);
        return;
      }

      try {
        setSellerInfo(null);
        setRelatedProducts([]);
        setLoading(true);
        setError(null);

        let productData;
        if (product?.userId && product?.categoryId && product?.subcategory) {
          productData = product;
        } else {
          const productRef = doc(db, "products", productId);
          const productSnap = await getDoc(productRef);

          if (!productSnap.exists()) {
            throw new Error("Product not found");
          }
          productData = { id: productId, ...productSnap.data() };
        }

        const { userId, categoryId, subcategory } = productData;

        if (!userId || !categoryId ) { // || !subcategory
          throw new Error("Incomplete product data");
        }

        const [sellerSnap, sellerProductsSnap, categorySnap, subCategorySnap] =
          await Promise.all([
            getDoc(doc(db, "users", userId)),
            getDocs(
              query(collection(db, "products"), where("userId", "==", userId))
            ),
            getDocs(
              query(
                collection(db, "products"),
                where("categoryId", "==", categoryId)
              )
            ),
            getDocs(
              query(
                collection(db, "products"),
                where("subcategory", "==", subcategory)
              )
            ),
          ]);

        if (sellerSnap.exists()) {
          setSellerInfo(sellerSnap.data());
        }

        const sellerProductsList = sellerProductsSnap.docs.map((doc) => ({
          id: doc.id,
          product: doc.data(),
        }));

        setSellersProducts(sellerProductsList);

        const processProducts = (snapshot, excludeId) =>
          snapshot.docs
            .filter((doc) => doc.id !== excludeId)
            .map((doc) => ({
              id: doc.id,
              product: doc.data(),
            }));

        const categoryProducts = processProducts(categorySnap, productId);
        const subcategoryProducts = processProducts(subCategorySnap, productId);

        const mergedRelated = [
          ...categoryProducts,
          ...subcategoryProducts,
        ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);

        setRelatedProducts(mergedRelated);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div>
      {/* Seller Info Section */}
      {sellerInfo && (
        <div className="mt-5 rounded-lg border border-blue-500 bg-gray-100 p-4">
          <h2 className="mb-2 text-lg font-bold">Seller Information</h2>
          <div className="flex items-start justify-between">
            <div className="relative w-16 h-16 rounded-full overflow-hidden">
              <Image
                src={sellerInfo.profilePicture || "/placeholder.svg"}
                alt="Seller"
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div>
              <p className="text-sm text-black truncate">
                Seller: {sellerInfo.fullName || "N/A"}
              </p>
              <p className="text-sm text-black truncate">
                Location: {sellerInfo.address || "Not specified"}
              </p>
              <button
                className="rounded-lg bg-blue-500 px-4 py-2 text-white font-semibold"
                onClick={() => router.push(`/shop?sellerId=${sellerProducts}`)}
                // onClick={() => router.push(`/shop?sellerId=${sellerInfo.id}`)}
              >
                View Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Related Products */}
      <div className="my-8">
        <h2 className="mb-4 text-center text-lg font-bold">Related Products</h2>
        {relatedProducts.length > 0 ? (
          <div className="flex flex-wrap justify-between gap-4">
            {relatedProducts.slice(0, 10).map((item) => (
              <div key={item.id} className="w-[48%]">
                <div
                  onClick={() => router.push(`/products/${item.id}`)}
                  className="cursor-pointer"
                >
                  <ListingCard product={item.product} btnName="View" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            No related products available
          </p>
        )}
      </div>
    </div>
  );
}
