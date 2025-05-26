import useFavoritesStore from '../lib/FavouriteStore';
import { db } from '../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState, useCallback } from 'react';

const fetchDocumentsByIdsBatch = async (collectionName, docIds) => {
  if (!docIds || docIds.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < docIds.length; i += 10) {
    chunks.push(docIds.slice(i, i + 10));
  }

  try {
    const promises = chunks.map(async (chunk) => {
      const q = query(collection(db, collectionName), where('__name__', 'in', chunk));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    });

    const results = await Promise.all(promises);
    return results.flat();
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
};

export const useFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [products, setProducts] = useState([]);
  const { favoriteIds, toggleFavorite } = useFavoritesStore();

  const fetchFavorites = useCallback(async () => {
    let isMounted = true;
    setLoading(true);

    try {
      const favoriteProducts = await fetchDocumentsByIdsBatch('products', favoriteIds);
      if (isMounted) {
        setProducts(
          favoriteProducts.map((product) => ({
            id: product.id,
            product: {
              ...product,
              createdAt: product.createdAt?.toDate?.() || null,
            },
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }, [favoriteIds]);

  const loadMore = async () => {
    return;
  };

  return {
    products,
    loading,
    isFetchingMore,
    fetchFavorites,
    loadMore,
    toggleFavorite,
  };
};
