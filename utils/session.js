/**
 * Session Tracking Utility
 * 
 * Generates and maintains session IDs for user journey tracking.
 * Sessions expire after 30 minutes of inactivity.
 * 
 * Usage:
 *   import { getOrCreateSessionId } from '@/utils/session';
 *   const sessionId = getOrCreateSessionId();
 */

const SESSION_KEY = 'trybe_session_id';
const LAST_ACTIVITY_KEY = 'trybe_last_activity';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get existing session ID or create a new one
 * 
 * @returns {string|null} Session ID or null if running on server
 * 
 * @example
 * trackEvent(EVENT_TYPES.LISTING_VIEWED, listingId, 'listing', {
 *   session_id: getOrCreateSessionId(),
 *   // ... other metadata
 * });
 */
export function getOrCreateSessionId() {
  // SSR guard — window doesn't exist on server in Next.js
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();

    // Check if session has expired (30 min of inactivity)
    const isExpired = lastActivity && (now - parseInt(lastActivity, 10)) > SESSION_TIMEOUT_MS;

    // Create new session if none exists or session expired
    if (!stored || isExpired) {
      const newSessionId = `${now}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, newSessionId);
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Session] New session created:', newSessionId);
      }
      
      return newSessionId;
    }

    // Update last activity timestamp
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    
    return stored;
  } catch (error) {
    // Privacy mode or storage blocked — return temporary in-memory ID
    console.warn('[Session] Storage unavailable, using temporary ID');
    return `temp_${Date.now()}`;
  }
}

/**
 * Get current session ID without creating a new one
 * 
 * @returns {string|null} Session ID or null if no session exists
 */
export function getCurrentSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Manually end the current session
 * Useful for logout flows
 */
export function endSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Session] Session ended');
    }
  } catch (error) {
    console.warn('[Session] Failed to end session:', error);
  }
}
