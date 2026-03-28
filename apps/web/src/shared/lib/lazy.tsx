/**
 * Lazy loading utilities for dynamic imports with Next.js.
 *
 * Provides:
 *   - `lazyLoad()` — typed wrapper around `next/dynamic` with standard loading/error states
 *   - `preloadComponent()` — triggers dynamic import ahead of time (e.g. on hover)
 *   - `preloadOnHover()` — attaches mouseenter/focus listeners to preload a component
 *
 * Why not raw `React.lazy()`?
 *   Next.js `dynamic()` integrates with the framework's SSR, streaming, and chunk
 *   naming. Using it directly gives us better bundle analysis and prefetch hints.
 *
 * @module shared/lib/lazy
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for `lazyLoad()`. */
export interface LazyLoadOptions {
  /** Whether to disable SSR for this component. Defaults to `true` for heavy client components. */
  ssr?: boolean;
  /** Custom loading component. Falls back to the standard skeleton. */
  loading?: ComponentType;
}

/**
 * A factory function returning a dynamic import promise.
 * Matches the signature `next/dynamic` expects.
 *
 * Uses `any` for the props type to allow the widest range of component
 * signatures — the returned ComponentType is typed via the generic `P`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicImportFactory<P = any> = () => Promise<{ default: ComponentType<P> }>;

// ---------------------------------------------------------------------------
// Preload cache — prevents duplicate imports
// ---------------------------------------------------------------------------

const preloadCache = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------------------
// lazyLoad
// ---------------------------------------------------------------------------

/**
 * Wraps `next/dynamic()` with project-standard defaults:
 *   - SSR disabled by default (heavy client components)
 *   - Standard loading skeleton
 *   - Named chunk for bundle analysis
 *
 * @example
 * ```ts
 * const GraphView = lazyLoad(
 *   () => import('@/features/graph/GraphCanvas'),
 *   { ssr: false },
 * );
 *
 * // In JSX:
 * <Suspense fallback={<GraphSkeleton />}>
 *   <GraphView workspaceId={id} />
 * </Suspense>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyLoad<P = any>(
  factory: DynamicImportFactory<P>,
  options: LazyLoadOptions = {},
): ComponentType<P> {
  const { ssr = false, loading } = options;

  return dynamic(factory, {
    ssr,
    loading: loading
      ? () => {
          const LoadingComponent = loading;
          return <LoadingComponent />;
        }
      : () => <LazyLoadingFallback />,
  });
}

// ---------------------------------------------------------------------------
// preloadComponent
// ---------------------------------------------------------------------------

/**
 * Eagerly triggers a dynamic import so the chunk is cached by the browser
 * before the user navigates. Idempotent — subsequent calls are no-ops.
 *
 * @param key   Unique string identifying the component (for dedup)
 * @param factory  The same `() => import(...)` factory used in `lazyLoad()`
 *
 * @example
 * ```ts
 * preloadComponent('graph-canvas', () => import('@/features/graph/GraphCanvas'));
 * ```
 */
export function preloadComponent(key: string, factory: () => Promise<unknown>): void {
  if (preloadCache.has(key)) return;
  const promise = factory();
  preloadCache.set(key, promise);
}

// ---------------------------------------------------------------------------
// preloadOnHover
// ---------------------------------------------------------------------------

/**
 * Returns event-handler props (`onMouseEnter`, `onFocus`) that trigger
 * `preloadComponent` on first interaction. Attach these to a link or button
 * to preload the target route's heavy component.
 *
 * @example
 * ```tsx
 * const hoverProps = preloadOnHover('settings', () => import('@/features/settings/SettingsDialog'));
 *
 * <Link href="/settings" {...hoverProps}>
 *   Settings
 * </Link>
 * ```
 */
export function preloadOnHover(
  key: string,
  factory: () => Promise<unknown>,
): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  const trigger = () => preloadComponent(key, factory);
  return {
    onMouseEnter: trigger,
    onFocus: trigger,
  };
}

// ---------------------------------------------------------------------------
// Standard loading fallback (inlined to avoid circular deps)
// ---------------------------------------------------------------------------

function LazyLoadingFallback() {
  return (
    <div className="flex h-full min-h-[120px] w-full items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
