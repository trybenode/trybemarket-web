/**
 * TrybeMarket Analytics Tracking Utility
 * 
 * Fire-and-forget event tracking that never blocks the UI.
 * All events are written to Firestore 'events' collection.
 * 
 * Usage:
 *   import { trackEvent, EVENT_TYPES } from '@/utils/analytics';
 *   trackEvent(EVENT_TYPES.LISTING_VIEWED, listingId, 'listing', { category: 'electronics' });
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

/**
 * Track a user event in Firestore
 * 
 * @param {string} eventType - One of EVENT_TYPES constants
 * @param {string|null} entityId - ID of related entity (listing, conversation, etc.)
 * @param {string|null} entityType - Type of entity ('listing', 'conversation', 'user', 'search', etc.)
 * @param {object} metadata - Additional event-specific data
 * 
 * @example
 * trackEvent(EVENT_TYPES.LISTING_VIEWED, 'listing-123', 'listing', {
 *   campus_id: 'unilag-001',
 *   category: 'electronics',
 *   seller_id: 'user-456'
 * });
 */
export async function trackEvent(eventType, entityId = null, entityType = null, metadata = {}) {
  try {
    const user = auth.currentUser;

    // Skip tracking for unauthenticated users
    // (Change this if you need anonymous tracking later)
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Skipped - no authenticated user');
      }
      return;
    }

    await addDoc(collection(db, 'events'), {
      event_type: eventType,
      user_id: user.uid,           // Always from Firebase Auth
      entity_id: entityId,
      entity_type: entityType,
      campus_id: metadata.campus_id || null,
      metadata,
      timestamp: serverTimestamp(), // Server timestamp prevents clock skew
      created_at: serverTimestamp(),
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Event tracked:', eventType, { entityId, entityType, metadata });
    }
  } catch (err) {
    // Silent fail — analytics must NEVER crash the app
    console.warn('[TrybeMarket Analytics] Failed to track event:', eventType, err);
  }
}

/**
 * Event type constants
 * Use these instead of raw strings to prevent typos
 */
export const EVENT_TYPES = {
  // User lifecycle
  USER_SIGNUP:          'USER_SIGNUP',
  USER_LOGIN:           'USER_LOGIN',
  PROFILE_COMPLETED:    'PROFILE_COMPLETED',
  UNIVERSITY_SELECTED:  'UNIVERSITY_SELECTED',
  
  // Listing engagement
  LISTING_VIEWED:       'LISTING_VIEWED',
  SEARCH_PERFORMED:     'SEARCH_PERFORMED',
  FAVORITE_ADDED:       'FAVORITE_ADDED',
  SHOP_VISITED:         'SHOP_VISITED',
  
  // Conversion events
  CONVERSATION_STARTED: 'CONVERSATION_STARTED',
  
  // Navigation
  PAGE_VIEW:            'PAGE_VIEW',
  
  // Revenue intent signals
  BOOST_CLICKED:        'BOOST_CLICKED',
  SUBSCRIPTION_PAGE_VIEWED: 'SUBSCRIPTION_PAGE_VIEWED',
};
