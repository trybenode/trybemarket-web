"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent, EVENT_TYPES } from '@/utils/analytics';
import { getOrCreateSessionId } from '@/utils/session';

/**
 * PageViewTracker Component
 * 
 * Tracks page views on every route change in Next.js App Router.
 * Add this to your root layout.jsx to enable page view tracking.
 * 
 * Usage in app/layout.jsx:
 *   import PageViewTracker from '@/components/PageViewTracker';
 *   
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           <PageViewTracker />
 *           {children}
 *         </body>
 *       </html>
 *     );
 *   }
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Track page view on every route change
    import('@/lib/userStore').then((module) => {
      const campus_id = module.default.getState().selectedUniversity || null;
      trackEvent(EVENT_TYPES.PAGE_VIEW, null, 'page', {
        path: pathname,
        session_id: getOrCreateSessionId(),
        referrer: typeof document !== 'undefined' ? document.referrer : null,
        campus_id,
      });
    });
  }, [pathname]); // Re-run when pathname changes

  // This component renders nothing — it only tracks
  return null;
}
