'use client';

/**
 * OfflineFallback — detects network status and shows a fallback UI when offline.
 *
 * Uses useSyncExternalStore (not useEffect) to subscribe to the browser's
 * online/offline events. This is the correct React 19 pattern for subscribing
 * to external browser APIs.
 *
 * Behavior:
 *   - Online: renders children normally
 *   - Offline: shows an overlay banner at the top with status and retry
 *   - Transition back to online: banner auto-dismisses
 */

import { type ReactNode, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// useSyncExternalStore subscription for navigator.onLine
// ---------------------------------------------------------------------------

function subscribeToOnlineStatus(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineStatusSnapshot(): boolean {
  return navigator.onLine;
}

function getServerOnlineStatusSnapshot(): boolean {
  // During SSR, assume online
  return true;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns true when the browser is online, false when offline.
 * Subscribes to real-time online/offline events without useEffect.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatusSnapshot,
    getServerOnlineStatusSnapshot,
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OfflineFallbackProps {
  children: ReactNode;
}

/**
 * Wraps content with an offline detection banner.
 *
 * When offline, renders the children with a persistent top-banner notification.
 * The banner includes a manual refresh button for users who want to retry.
 *
 * Note: This does NOT prevent children from rendering — the app still works
 * with cached data. The banner is purely informational.
 */
export function OfflineFallback({ children }: OfflineFallbackProps) {
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && <OfflineBanner />}
      {children}
    </>
  );
}

/**
 * Full-screen offline page for when the app cannot function at all without
 * network connectivity. Use this at route boundaries for server-dependent pages.
 */
export function OfflinePage() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="max-w-md text-center">
        {/* Wifi-off icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-muted">
          <svg
            className="h-8 w-8 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0122.56 9" />
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
            <path d="M8.53 16.11a6 6 0 016.95 0" />
            <circle cx="12" cy="20" r="1" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-foreground">You are offline</h1>

        <p className="mt-2 text-sm text-foreground-secondary">
          Notesaner requires an internet connection to sync your notes. Your local changes will be
          saved when you reconnect.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry connection
        </button>

        <p className="mt-4 text-xs text-foreground-muted">
          Check your network connection and try again.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner sub-component
// ---------------------------------------------------------------------------

function OfflineBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-[var(--ns-z-toast)] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-medium text-warning-foreground"
      style={{
        // Fallback for the text color on warning background
        color: '#1e1e2e',
      }}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M8.53 16.11a6 6 0 016.95 0"
        />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>
      <span>You are offline. Changes will sync when reconnected.</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 rounded bg-black/10 px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-black/20"
      >
        Retry
      </button>
    </div>
  );
}
