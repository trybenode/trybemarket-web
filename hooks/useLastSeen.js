import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Hook to automatically track user's last activity timestamp
 * Updates Firestore user document with lastSeen timestamp
 */
export function useLastSeen(userId) {
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    
    // Update lastSeen on mount and visibility change
    const updateLastSeen = async () => {
      try {
        await updateDoc(userRef, {
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        console.error('Error updating lastSeen:', error);
      }
    };

    // Update immediately when hook runs
    updateLastSeen();

    // Update when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateLastSeen();
      }
    };

    // Update periodically while user is active (every 2 minutes)
    const interval = setInterval(() => {
      if (!document.hidden) {
        updateLastSeen();
      }
    }, 120000); // 2 minutes

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
}

/**
 * Check if a user was recently active (within last 5 minutes)
 * @param {Timestamp} lastSeenTimestamp - Firestore timestamp
 * @returns {boolean} - true if user is considered "online"
 */
export function isUserRecentlyActive(lastSeenTimestamp) {
  if (!lastSeenTimestamp) return false;
  
  const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
  const lastSeenDate = lastSeenTimestamp.toDate();
  const now = new Date();
  
  return (now - lastSeenDate) < ACTIVE_THRESHOLD;
}
