'use client';

import { useSyncExternalStore } from 'react';

/**
 * Breakpoint thresholds aligned with Tailwind CSS defaults.
 *
 * - mobile:  < 640px  (phones)
 * - tablet:  640-1024px (tablets, small laptops)
 * - desktop: > 1024px (laptops, desktops)
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = 640;
const TABLET_MAX = 1024;

function getBreakpoint(width: number): Breakpoint {
  if (width < MOBILE_MAX) return 'mobile';
  if (width < TABLET_MAX) return 'tablet';
  return 'desktop';
}

function getServerSnapshot(): Breakpoint {
  // Default to desktop during SSR to avoid layout shift for majority of users.
  // Client will correct immediately on hydration.
  return 'desktop';
}

function getSnapshot(): Breakpoint {
  return getBreakpoint(window.innerWidth);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/**
 * Returns the current responsive breakpoint category.
 *
 * Uses `useSyncExternalStore` to subscribe to window resize events
 * without any useEffect. SSR-safe with desktop as the server default.
 *
 * @example
 * ```tsx
 * const breakpoint = useBreakpoint();
 * const isMobile = breakpoint === 'mobile';
 * ```
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience boolean helpers derived from the breakpoint.
 */
export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}

export function useIsTablet(): boolean {
  return useBreakpoint() === 'tablet';
}

export function useIsDesktop(): boolean {
  return useBreakpoint() === 'desktop';
}
