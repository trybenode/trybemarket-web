import { useState } from "react";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

export const useAddSellerReview = () => {
  const [submitting, setSubmitting] = useState(false);

  const submitSellerReview = async ({ buyerId, sellerId, rating, review }) => {
    console.log("Review payload", { buyerId, sellerId, rating, review });

    if (!buyerId || !sellerId || rating < 1) {
      toast.error("Missing required fields");
      return;
    }

    try {
      setSubmitting(true);

    
      const reviewRef = doc(db, "reviews", sellerId, "userReviews", buyerId);

      const payload = {
        buyerId,
        sellerId,
        rating,
        review,
        createdAt: new Date().toISOString(),
      };

      await setDoc(reviewRef, payload);

      // Calculate average
      const allReviewSnap = await getDocs(
        collection(db, "reviews", sellerId, "userReviews")
      );
      const ratings = allReviewSnap.docs.map((doc) => doc.data().rating);
      const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      await updateDoc(doc(db, "users", sellerId), {
        averageRating,
        totalRatings: ratings.length,
      });

      toast.success("Rating Submitted");
    } catch (error) {
      console.error(" Firestore error:", error.code, error.message, error);
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return { submitSellerReview, submitting };
};
