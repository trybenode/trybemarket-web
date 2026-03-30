"use client"

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useLastSeen } from '@/hooks/useLastSeen';

/**
 * Component that tracks user's last activity timestamp
 * Should be included in the root layout
 */
export default function UserActivityTracker() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });

    return () => unsubscribe();
  }, []);

  // Track user activity
  useLastSeen(userId);

  return null; // This component doesn't render anything
}
