import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export const useServiceCategories = () => {
  const [categories, setCategories] = useState(["All"]); // Default to ["All"]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "serviceCategories"));
        const fetchedCategories = querySnapshot.docs.map((doc) => doc.data().name); 
        setCategories(["All", ...fetchedCategories]); // Prepend "All" to the fetched categories
      } catch (err) {
        setError(err.message);
        console.error("Error fetching service categories:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
};