import { useState, useEffect } from "react";

export const useServiceCategories = () => {
  const [categories, setCategories] = useState(["All"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await fetch("/serviceCategories.json"); 
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        // Flatten category names
        const categoryNames = data.map((category) => category.label);
        setCategories(["All", ...categoryNames]);
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
