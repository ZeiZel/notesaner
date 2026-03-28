'use client';

/**
 * VirtualList — reusable virtualized list component built on @tanstack/react-virtual.
 *
 * Use cases:
 *   - Search results
 *   - Note lists in tag/folder views
 *   - Any flat list with many items
 *
 * Features:
 *   - Fixed or dynamic item heights
 *   - Scroll position preserved on data refresh
 *   - Overscan for smooth scrolling
 *   - Smooth scroll-to-index API
 *   - Accessible keyboard navigation support
 *
 * @module shared/lib/VirtualList
 */

import {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VirtualListProps<T> {
  /** The full data array. Only visible items are rendered in the DOM. */
  items: T[];
  /** Estimated height of each item in px. Used for initial layout before measurement. */
  estimateSize: number;
  /**
   * Render function for each item.
   * Receives the data item, its index, and the virtual item for measurement.
   */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
  /** Unique key extractor. Defaults to index. */
  getItemKey?: (item: T, index: number) => string | number;
  /** Number of items to render outside the visible area (each direction). Defaults to 5. */
  overscan?: number;
  /** Container className. */
  className?: string;
  /** Container inline styles. */
  style?: CSSProperties;
  /** ARIA role for the list container. Defaults to 'list'. */
  role?: string;
  /** ARIA label for the list container. */
  'aria-label'?: string;
  /** Called when scroll reaches the bottom (infinite scroll). */
  onReachEnd?: () => void;
  /** Threshold in px from the bottom to trigger `onReachEnd`. Defaults to 200. */
  reachEndThreshold?: number;
  /** Empty state rendered when items is empty. */
  emptyState?: ReactNode;
}

export interface VirtualListHandle {
  /** Smooth-scroll to a specific index. */
  scrollToIndex: (index: number) => void;
  /** Scroll to the top. */
  scrollToTop: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VirtualListInner<T>(
  {
    items,
    estimateSize,
    renderItem,
    getItemKey,
    overscan = 5,
    className,
    style,
    role = 'list',
    'aria-label': ariaLabel,
    onReachEnd,
    reachEndThreshold = 200,
    emptyState,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>,
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index] as NonNullable<T>, index)
      : undefined,
  });

  // Expose imperative scroll methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
    },
    scrollToTop: () => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }));

  // Infinite scroll sentinel
  const handleScroll = useCallback(() => {
    if (!onReachEnd) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < reachEndThreshold) {
      onReachEnd();
    }
  }, [onReachEnd, reachEndThreshold]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      className={className}
      style={{ overflow: 'auto', ...style }}
      onScroll={handleScroll}
      role={role}
      aria-label={ariaLabel}
    >
      {/* Total height spacer */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index] as NonNullable<T>;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Virtualized flat list. Only renders visible items + overscan in the DOM.
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={searchResults}
 *   estimateSize={64}
 *   getItemKey={(r) => r.id}
 *   renderItem={(result, index) => <SearchResultCard result={result} />}
 *   className="h-full"
 *   aria-label="Search results"
 * />
 * ```
 */
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> },
) => ReactNode;
