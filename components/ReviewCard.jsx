'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Star } from 'lucide-react';

export default function ReviewCard({ sellerId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;

    const fetchReviews = async () => {
      setLoading(true);
      try {
        const reviewsRef = collection(db, 'reviews', sellerId, 'userReviews');
        const snapshot = await getDocs(reviewsRef);
        const reviewsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setReviews(reviewsData);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [sellerId]);

  if (loading) return <div className="flex justify-center items-center py-6">
    <p className="text-sm text-gray-500">Loading reviews...</p>;
  </div>
  if (!reviews.length) return <div className="flex justify-center items-center py-6">
    <p className="text-sm text-gray-400">No reviews yet.</p>
  </div>

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {[...Array(5)].map((_, index) => (
              <Star
                key={index}
                className={`w-4 h-4 ${review.rating > index ? 'text-yellow-500' : 'text-gray-300'}`}
                fill={review.rating > index ? 'currentColor' : 'none'}
              />
            ))}
            <span className="text-sm text-gray-600 ml-auto">
              {new Date(review.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-700">{review.review}</p>
          <p className="text-xs text-yellow-700 text-center">     {review.buyerName}</p>
        </div>
      ))}
    </div>
  );
}