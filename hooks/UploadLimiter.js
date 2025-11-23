import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getUserLimits, isSubscriptionActive } from '@/lib/subscriptionStore';

/**
 * Check if user can upload a product based on their subscription limits
 * @returns {Promise<{canUpload: boolean, currentCount: number, limit: number, message?: string}>}
 */
export const canUserUploadProduct = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    // Get user's current limits based on subscription
    const limits = await getUserLimits(userId);
    
    // Count existing products
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const currentCount = snapshot.size;

    const canUpload = currentCount < limits.maxProducts;

    return {
      canUpload,
      currentCount,
      limit: limits.maxProducts,
      message: canUpload 
        ? null 
        : `You've reached your limit of ${limits.maxProducts} products. Upgrade to add more!`
    };
  } catch (error) {
    console.error('Error checking upload limit:', error);
    throw error;
  }
};

/**
 * Check if user can upload a service based on their subscription limits
 * @returns {Promise<{canUpload: boolean, currentCount: number, limit: number, message?: string}>}
 */
export const canUserUploadService = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    // Get user's current limits based on subscription
    const limits = await getUserLimits(userId);
    
    // Count existing services
    const servicesRef = collection(db, 'services');
    const q = query(servicesRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const currentCount = snapshot.size;

    const canUpload = currentCount < limits.maxServices;

    return {
      canUpload,
      currentCount,
      limit: limits.maxServices,
      message: canUpload 
        ? null 
        : `You've reached your limit of ${limits.maxServices} services. Upgrade to add more!`
    };
  } catch (error) {
    console.error('Error checking upload limit:', error);
    throw error;
  }
};

/**
 * Check if user can mark item as VIP based on their subscription
 * @returns {Promise<{canMarkVip: boolean, currentVipCount: number, limit: number, message?: string}>}
 */
export const canUserMarkAsVip = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    const limits = await getUserLimits(userId);
    
    if (limits.vipTags === 0) {
      return {
        canMarkVip: false,
        currentVipCount: 0,
        limit: 0,
        message: 'Upgrade to Premium or VIP to mark items as VIP!'
      };
    }

    // Count current VIP items (products + services)
    const productsRef = collection(db, 'products');
    const servicesRef = collection(db, 'services');
    
    const productsQ = query(productsRef, where('userId', '==', userId), where('isVip', '==', true));
    const servicesQ = query(servicesRef, where('userId', '==', userId), where('isVip', '==', true));
    
    const [productsSnap, servicesSnap] = await Promise.all([
      getDocs(productsQ),
      getDocs(servicesQ)
    ]);
    
    const currentVipCount = productsSnap.size + servicesSnap.size;
    const canMarkVip = currentVipCount < limits.vipTags;

    return {
      canMarkVip,
      currentVipCount,
      limit: limits.vipTags,
      message: canMarkVip 
        ? null 
        : `You've used all ${limits.vipTags} VIP tags. Upgrade for more!`
    };
  } catch (error) {
    console.error('Error checking VIP limit:', error);
    throw error;
  }
};

// Legacy support - keeping old function name for backward compatibility
export const canUserUpload = canUserUploadProduct;

// No longer needed with new subscription system - limits are enforced on check, not incremented
export const incrementUploadCount = async () => {
  console.warn('incrementUploadCount is deprecated with new subscription system');
  return true;
};