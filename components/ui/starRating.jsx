'use client';

import React from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

export default function StarRating({ value, onChange, readOnly = false, size = 24 }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange(star)}
          className={clsx(
            'transition-colors duration-150',
            value >= star ? 'text-yellow-500' : 'text-gray-300',
            readOnly ? 'cursor-default' : 'hover:text-yellow-400'
          )}
          disabled={readOnly}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star fill={value >= star ? 'currentColor' : 'none'} size={size} />
        </button>
      ))}
    </div>
  );
}
