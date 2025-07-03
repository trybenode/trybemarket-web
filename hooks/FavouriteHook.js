import useFavoritesStore from '../lib/FavouriteStore';
import { db } from '../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState, useCallback, useEffect } from 'react';

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
  const [services, setServices] = useState([]);
  const { favoriteIds, toggleFavorite, loadFavorites } = useFavoritesStore();

  // Load favorites from localStorage on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const fetchFavorites = useCallback(async () => {
    if (!favoriteIds || favoriteIds.length === 0) {
      setProducts([]);
      setServices([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch both products and services
      const [favoriteProducts, favoriteServices] = await Promise.all([
        fetchDocumentsByIdsBatch('products', favoriteIds),
        fetchDocumentsByIdsBatch('services', favoriteIds),
      ]);
      setProducts(favoriteProducts);
      setServices(favoriteServices);
    } catch (error) {
      setProducts([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [favoriteIds]);

  // Fetch products and services whenever favoriteIds changes
  useEffect(() => {
    fetchFavorites();
  }, [favoriteIds, fetchFavorites]);

  const loadMore = async () => {
    return;
  };

  return {
    products,
    services,
    loading,
    isFetchingMore,
    fetchFavorites,
    loadMore,
    toggleFavorite,
  };
};
