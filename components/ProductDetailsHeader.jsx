import { Heart } from "lucide-react";
import BackButton from "../components/BackButton";
import React, { useState } from "react";
import { toast } from "react-hot-toast";

import {Button} from "../components/ui/button";

export default function ProductDetailsHeader() {
  const [liked, setLiked] = useState(false);

  const handleLiked = () => {
    setLiked(!liked);
    toast.success(liked ? "Removed from favorites" : "Added to favorites", {
      duration: 2000,
      position: "top-right",
    });
  };
  return (
    <div className="mb-6 flex justify-between items-center">
      <BackButton />

      <h1 className="text-2xl font-bold text-gray-900">Listing Details </h1>
      <Button variant="ghost"  onClick={handleLiked}>
        <Heart
          className={`h-6 w-6 ${liked ? "fill-red-500 text-red-500" : ""}`}
        />
      </Button>
    </div>
  );
}
