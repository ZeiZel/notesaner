import type { Metadata } from 'next';
import { OfflinePage } from '@/shared/ui/OfflineFallback';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline. Please check your network connection.',
  robots: { index: false, follow: false },
};

/**
 * Offline fallback page — served by the service worker when a navigation
 * request fails due to no network connectivity.
 *
 * The OfflinePage component from shared/ui handles:
 *   - Detecting when the browser comes back online (auto-redirects)
 *   - Showing a user-friendly message with a retry button
 */
export default function OfflineRoute() {
  return <OfflinePage />;
}
