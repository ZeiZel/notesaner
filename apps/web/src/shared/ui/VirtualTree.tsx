'use client';

/**
 * VirtualTree — virtualized tree component for the file explorer sidebar.
 *
 * Built on @tanstack/react-virtual. Flattens the tree into a visible-node
 * list based on expanded state, then virtualizes that flat list.
 *
 * Features:
 *   - Only visible (expanded) nodes are measured and rendered
 *   - Dynamic heights: folder headings vs note items
 *   - Keyboard navigation (ArrowUp/Down, Enter to toggle, Left/Right to collapse/expand)
 *   - Smooth scroll to the active/selected item
 *   - Scroll position preserved across data refreshes via stable keys
 *
 * The tree data model uses a generic `TreeNode<T>` type so it can represent
 * file trees, tag trees, or any hierarchical data.
 *
 * @module shared/lib/VirtualTree
 */

import {
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

export interface TreeNode<T = unknown> {
  /** Unique ID for the node (used as React key and for expand/select state). */
  id: string;
  /** Child nodes. Empty array or undefined for leaf nodes. */
  children?: TreeNode<T>[];
  /** Arbitrary payload attached to this node. */
  data: T;
}

// ---------------------------------------------------------------------------
// Flattened node (internal)
// ---------------------------------------------------------------------------

export interface FlatNode<T = unknown> {
  /** Original node reference. */
  node: TreeNode<T>;
  /** Nesting depth (0 = root). */
  depth: number;
  /** Whether this node has children. */
  isParent: boolean;
  /** Whether this node is expanded (always false for leaves). */
  isExpanded: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VirtualTreeProps<T> {
  /** Root-level nodes of the tree. */
  roots: TreeNode<T>[];
  /** Set of expanded node IDs. Controlled from parent. */
  expandedIds: Set<string>;
  /** Currently selected/active node ID. */
  selectedId?: string | null;
  /** Called when user toggles a parent node. */
  onToggle: (nodeId: string) => void;
  /** Called when user selects a node (click or Enter). */
  onSelect: (nodeId: string) => void;
  /**
   * Render a single tree row.
   * The component should NOT add its own positioning — only content.
   */
  renderNode: (flatNode: FlatNode<T>, virtualItem: VirtualItem) => ReactNode;
  /** Estimated height per row in px. Defaults to 28. */
  estimateSize?: number;
  /** Overscan count (each direction). Defaults to 8. */
  overscan?: number;
  /** Container className. */
  className?: string;
  /** ARIA label for the tree. */
  'aria-label'?: string;
}

export interface VirtualTreeHandle {
  /** Smooth-scroll to a specific node by ID. */
  scrollToNode: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Flatten helper
// ---------------------------------------------------------------------------

function flattenTree<T>(nodes: TreeNode<T>[], expandedIds: Set<string>, depth = 0): FlatNode<T>[] {
  const result: FlatNode<T>[] = [];
  for (const node of nodes) {
    const isParent = !!node.children && node.children.length > 0;
    const isExpanded = isParent && expandedIds.has(node.id);
    result.push({ node, depth, isParent, isExpanded });
    if (isExpanded && node.children) {
      result.push(...flattenTree(node.children, expandedIds, depth + 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VirtualTreeInner<T>(
  {
    roots,
    expandedIds,
    selectedId,
    onToggle,
    onSelect,
    renderNode,
    estimateSize = 28,
    overscan = 8,
    className,
    'aria-label': ariaLabel,
  }: VirtualTreeProps<T>,
  ref: React.ForwardedRef<VirtualTreeHandle>,
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Flatten visible tree nodes
  const flatNodes = useMemo(() => flattenTree(roots, expandedIds), [roots, expandedIds]);

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => (flatNodes[index] as NonNullable<(typeof flatNodes)[0]>).node.id,
  });

  // Scroll to a specific node
  const scrollToNode = useCallback(
    (nodeId: string) => {
      const index = flatNodes.findIndex((n) => n.node.id === nodeId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
      }
    },
    [flatNodes, virtualizer],
  );

  useImperativeHandle(ref, () => ({ scrollToNode }));

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!selectedId) return;

      const currentIndex = flatNodes.findIndex((n) => n.node.id === selectedId);
      if (currentIndex < 0) return;

      const currentNode = flatNodes[currentIndex] as NonNullable<(typeof flatNodes)[0]>;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, flatNodes.length - 1);
          onSelect((flatNodes[nextIndex] as NonNullable<(typeof flatNodes)[0]>).node.id);
          virtualizer.scrollToIndex(nextIndex, { align: 'auto', behavior: 'smooth' });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          onSelect((flatNodes[prevIndex] as NonNullable<(typeof flatNodes)[0]>).node.id);
          virtualizer.scrollToIndex(prevIndex, { align: 'auto', behavior: 'smooth' });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (currentNode.isParent && !currentNode.isExpanded) {
            onToggle(currentNode.node.id);
          } else if (
            currentNode.isParent &&
            currentNode.isExpanded &&
            currentNode.node.children?.length
          ) {
            // Move to first child
            const nextIndex = currentIndex + 1;
            if (nextIndex < flatNodes.length) {
              onSelect((flatNodes[nextIndex] as NonNullable<(typeof flatNodes)[0]>).node.id);
              virtualizer.scrollToIndex(nextIndex, { align: 'auto', behavior: 'smooth' });
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (currentNode.isParent && currentNode.isExpanded) {
            onToggle(currentNode.node.id);
          } else if (currentNode.depth > 0) {
            // Move to parent
            for (let i = currentIndex - 1; i >= 0; i--) {
              if ((flatNodes[i] as NonNullable<(typeof flatNodes)[0]>).depth < currentNode.depth) {
                onSelect((flatNodes[i] as NonNullable<(typeof flatNodes)[0]>).node.id);
                virtualizer.scrollToIndex(i, { align: 'auto', behavior: 'smooth' });
                break;
              }
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (currentNode.isParent) {
            onToggle(currentNode.node.id);
          }
          onSelect(currentNode.node.id);
          break;
        }
      }
    },
    [selectedId, flatNodes, onToggle, onSelect, virtualizer],
  );

  // Precompute aria-setsize and aria-posinset for each flat node.
  // Groups siblings that share the same parent (same depth after a depth-1 node).
  const ariaPositionMap = useMemo(() => {
    const map = new Map<number, { setSize: number; posInSet: number }>();
    // Simple approach: group consecutive runs at each depth.
    // Walk the flat list and assign set position by grouping siblings.
    // Second pass to assign positions.
    const depthCounters: number[] = [];

    for (let i = 0; i < flatNodes.length; i++) {
      const d = (flatNodes[i] as NonNullable<(typeof flatNodes)[0]>).depth;
      // If previous node was shallower, reset all deeper counters.
      if (i > 0 && (flatNodes[i - 1] as NonNullable<(typeof flatNodes)[0]>).depth < d) {
        depthCounters[d] = 0;
      }
      if (depthCounters[d] === undefined) depthCounters[d] = 0;
      depthCounters[d]++;
      map.set(i, { setSize: 0, posInSet: depthCounters[d] as number });
    }

    // Third pass: compute setSize by counting siblings per group.
    // Walk backwards to set the setSize for each group.
    const finalSizes: number[] = [];
    for (let i = flatNodes.length - 1; i >= 0; i--) {
      const d = (flatNodes[i] as NonNullable<(typeof flatNodes)[0]>).depth;
      if (finalSizes[d] === undefined) finalSizes[d] = 0;
      finalSizes[d]++;
      // If this is first at this depth or previous was at a different group.
      if (i === 0 || (flatNodes[i - 1] as NonNullable<(typeof flatNodes)[0]>).depth < d) {
        // Set the size for all siblings in this group.
        const size = finalSizes[d] as number;
        for (
          let j = i;
          j < flatNodes.length && (flatNodes[j] as NonNullable<(typeof flatNodes)[0]>).depth >= d;
          j++
        ) {
          if ((flatNodes[j] as NonNullable<(typeof flatNodes)[0]>).depth === d) {
            const existing = map.get(j);
            if (existing) existing.setSize = size;
          }
        }
        finalSizes[d] = 0;
      }
    }

    return map;
  }, [flatNodes]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      className={className}
      style={{ overflow: 'auto' }}
      role="tree"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const flatNode = flatNodes[virtualItem.index] as NonNullable<(typeof flatNodes)[0]>;
          const pos = ariaPositionMap.get(virtualItem.index);
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="treeitem"
              aria-expanded={flatNode.isParent ? flatNode.isExpanded : undefined}
              aria-selected={flatNode.node.id === selectedId}
              aria-level={flatNode.depth + 1}
              aria-setsize={pos?.setSize}
              aria-posinset={pos?.posInSet}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderNode(flatNode, virtualItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Virtualized tree component. Flattens expanded nodes and only renders
 * visible rows in the DOM.
 *
 * @example
 * ```tsx
 * <VirtualTree
 *   roots={fileTree}
 *   expandedIds={expandedFolders}
 *   selectedId={selectedFileId}
 *   onToggle={handleToggle}
 *   onSelect={handleSelect}
 *   renderNode={(flatNode) => (
 *     <FileTreeRow node={flatNode} />
 *   )}
 *   className="h-full"
 *   aria-label="File explorer"
 * />
 * ```
 */
export const VirtualTree = forwardRef(VirtualTreeInner) as <T>(
  props: VirtualTreeProps<T> & { ref?: React.Ref<VirtualTreeHandle> },
) => ReactNode;
