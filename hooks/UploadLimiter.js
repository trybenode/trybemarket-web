import {doc,getDoc, setDoc, updateDoc, serverTimestamp, increment} from 'firebase/firestore'
import {auth,db} from '../lib/firebase'


export const canUserUpload = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const subscriptionRef = doc(db, 'subscriptions', userId);
  const subscriptionSnap = await getDoc(subscriptionRef);

  let subscription;
  if (!subscriptionSnap.exists()) {
    // Create a default subscription for free-tier users
    subscription = {
      isActive: false,
      planId: 'Freemium',
      uploadStats: {
        uploadCount: 0,
        lastReset: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      userId,
    };
    await setDoc(subscriptionRef, subscription);
  } else {
    subscription = subscriptionSnap.data();
  }

  const now = new Date();
  const expiryDate = subscription.expiryDate?.toDate ? subscription.expiryDate.toDate() : null;

  const isPremium =
    subscription.isActive && subscription.planId === 'Premium' && expiryDate && expiryDate > now;

  if (isPremium) {
    return true; // No upload limit for premium users
  }

  // Freemium: Check or reset upload count
  let stats = subscription.uploadStats || {
    uploadCount: 0,
    lastReset: new Date(0),
  };

  const lastReset = stats.lastReset?.toDate ? stats.lastReset.toDate() : new Date(0);
  const isNewMonth =
    now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    stats.uploadCount = 0;
    await updateDoc(subscriptionRef, {
      'uploadStats.uploadCount': 0,
      'uploadStats.lastReset': serverTimestamp(),
    });
  }

  return stats.uploadCount < 5;
};
export const incrementUploadCount = async () =>{
    const userId = auth.currentUser?.uid;
    if(!userId) throw new Error('User not authenticated');

    const subscriptionRef = doc(db, 'subscriptions', userId);
    const subscriptionSnap = await getDoc(subscriptionRef);

    try {
        if(!subscriptionSnap.exists()){
            await setDoc(subscriptionRef, {
                isActive: false,
                planId:'Freemium',
                uploadStats :{
                    uploadCount: 1,
                    lastReset: serverTimestamp(),
                },
                createdAt: serverTimestamp(),
                userId,
            });
        }else{
            await updateDoc(subscriptionRef,{
                'uploadStats.uploadCount': increment(1), 
            });
        }
    }catch (error) {
        console.error("Error Incrementing upload count: ", error);
        throw error;
    }
}