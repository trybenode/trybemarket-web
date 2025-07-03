'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
 import StarRating from "./ui/starRating";
import { useAddSellerReview } from '@/hooks/useAddSellerReview';
import { useUser } from '@/context/UserContext';

export default function ReviewForm({ sellerId }) {
  const { currentUser } = useUser();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const { submitSellerReview, submitting } = useAddSellerReview();

  const handleSubmit = async (e) => {
    console.log("💡 Submitting review with:", {
  buyerId: currentUser?.id,
  buyerName: currentUser?.fullName,
  sellerId,
  rating,
  review,
});

    e.preventDefault();
    if (!currentUser?.id) {
    toast.error("You must be logged in to submit a review");
    return;
  }

    await submitSellerReview({
      
      buyerId: currentUser?.id,
      buyerName: currentUser.fullName || "Anonymous",
      sellerId,
      rating,
      review,
    });
    setOpen(false);
    setRating(0);
    setReview('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Rate Seller</Button>
      </DialogTrigger>
      <DialogContent ar className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rate This Seller</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <StarRating value={rating} onChange={setRating} />
            <textarea
              className="w-full border rounded-md p-2 text-sm"
              rows={4}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Leave a short review"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
