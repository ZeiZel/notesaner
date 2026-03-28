'use client';

/**
 * TabBar -- the global workspace tab bar.
 *
 * Shows ALL open buffers as draggable tabs at the top of the workspace
 * center area. This is a workspace-global bar (not per-pane).
 *
 * Features:
 *   - Drag-and-drop reordering via @dnd-kit/sortable
 *   - Right-click context menu (Close, Close Others, Close All, etc.)
 *   - Pinned tabs (icon-only, always on the left)
 *   - Dirty indicator (dot) for unsaved notes
 *   - Middle-click to close
 *   - Overflow scroll with left/right arrow buttons
 *   - New tab (+) button at right end
 *   - Double-click empty space creates new untitled note
 *   - Tab count badge when many tabs are open
 *   - Keyboard shortcuts: Cmd+W close, Cmd+Tab / Cmd+Shift+Tab cycle
 */

import { type MouseEvent, useCallback, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Dropdown, Badge } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
  PushpinOutlined,
  CopyOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { cn } from '@/shared/lib/utils';
import { useTabStore } from '@/shared/stores/tab-store';
import { useKeyboardShortcut } from '@/shared/hooks/useKeyboardShortcut';
import { TabItem } from './TabItem';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold for showing "tab count" badge. */
const TAB_COUNT_BADGE_MIN = 8;

/** Scroll distance per arrow click. */
const SCROLL_STEP = 200;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeToTheRight = useTabStore((s) => s.closeToTheRight);
  const closeSaved = useTabStore((s) => s.closeSaved);
  const closeAll = useTabStore((s) => s.closeAll);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const togglePinTab = useTabStore((s) => s.togglePinTab);
  const openTab = useTabStore((s) => s.openTab);
  const cycleTab = useTabStore((s) => s.cycleTab);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Sorted tabs: pinned first, then unpinned (preserving relative order within each group)
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const tabIds = sortedTabs.map((t) => t.id);

  // -- DnD sensors --
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // -- Keyboard shortcuts --
  useKeyboardShortcut('close-tab', 'global', () => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  });

  useKeyboardShortcut('cycle-tab-forward', 'global', () => {
    cycleTab(1);
  });

  useKeyboardShortcut('cycle-tab-backward', 'global', () => {
    cycleTab(-1);
  });

  // -- Scroll helpers --
  const scrollLeft = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
  }, []);

  // -- DnD handler --
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    },
    [tabs, reorderTabs],
  );

  // -- Context menu --
  const handleContextMenu = useCallback((event: MouseEvent, tabId: string) => {
    event.preventDefault();
    setContextMenuTabId(tabId);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuTabId(null);
    setContextMenuPosition(null);
  }, []);

  const contextTab = contextMenuTabId ? tabs.find((t) => t.id === contextMenuTabId) : null;

  const contextMenuItems: MenuProps['items'] = contextMenuTabId
    ? [
        {
          key: 'close',
          icon: <CloseOutlined />,
          label: 'Close',
          onClick: () => {
            closeTab(contextMenuTabId);
            closeContextMenu();
          },
        },
        {
          key: 'close-others',
          icon: <DeleteOutlined />,
          label: 'Close Others',
          onClick: () => {
            closeOthers(contextMenuTabId);
            closeContextMenu();
          },
        },
        {
          key: 'close-to-right',
          label: 'Close to the Right',
          onClick: () => {
            closeToTheRight(contextMenuTabId);
            closeContextMenu();
          },
        },
        {
          key: 'close-saved',
          label: 'Close Saved',
          onClick: () => {
            closeSaved();
            closeContextMenu();
          },
        },
        {
          key: 'close-all',
          label: 'Close All',
          danger: true,
          onClick: () => {
            closeAll();
            closeContextMenu();
          },
        },
        { type: 'divider' as const },
        {
          key: 'pin',
          icon: <PushpinOutlined />,
          label: contextTab?.isPinned ? 'Unpin Tab' : 'Pin Tab',
          onClick: () => {
            togglePinTab(contextMenuTabId);
            closeContextMenu();
          },
        },
        { type: 'divider' as const },
        {
          key: 'copy-path',
          icon: <CopyOutlined />,
          label: 'Copy Path',
          onClick: () => {
            if (contextTab?.path) {
              void navigator.clipboard.writeText(contextTab.path);
            }
            closeContextMenu();
          },
        },
        {
          key: 'reveal-in-explorer',
          icon: <FolderOpenOutlined />,
          label: 'Reveal in File Explorer',
          onClick: () => {
            // TODO: integrate with file explorer sidebar panel focus
            closeContextMenu();
          },
        },
      ]
    : [];

  // -- New tab handler --
  const handleNewTab = useCallback(() => {
    openTab({
      noteId: `untitled-${Date.now()}`,
      title: 'Untitled',
      path: '/Untitled.md',
    });
  }, [openTab]);

  // -- Double-click empty space creates new untitled note --
  const handleDoubleClickEmpty = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // Only trigger on the container itself, not on child tabs
      if (event.target === event.currentTarget) {
        handleNewTab();
      }
    },
    [handleNewTab],
  );

  // -- Tab activation --
  const handleActivate = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
    },
    [setActiveTab],
  );

  // -- Tab close --
  const handleClose = useCallback(
    (tabId: string) => {
      closeTab(tabId);
    },
    [closeTab],
  );

  return (
    <div
      className="relative flex h-8 w-full items-stretch border-b border-border bg-background-surface"
      role="tablist"
      aria-label="Open tabs"
    >
      {/* Left scroll arrow */}
      <button
        type="button"
        className="flex w-6 shrink-0 items-center justify-center text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
        onClick={scrollLeft}
        aria-label="Scroll tabs left"
        tabIndex={-1}
      >
        <LeftOutlined className="text-[10px]" />
      </button>

      {/* Scrollable tab container with drag-and-drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollContainerRef}
            className="flex flex-1 items-stretch overflow-x-auto scrollbar-none"
            onDoubleClick={handleDoubleClickEmpty}
          >
            {sortedTabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={handleActivate}
                onClose={handleClose}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Right scroll arrow */}
      <button
        type="button"
        className="flex w-6 shrink-0 items-center justify-center text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
        onClick={scrollRight}
        aria-label="Scroll tabs right"
        tabIndex={-1}
      >
        <RightOutlined className="text-[10px]" />
      </button>

      {/* New tab button + tab count badge */}
      <div className="flex shrink-0 items-center gap-1 border-l border-border px-1">
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-sm',
            'text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground',
          )}
          onClick={handleNewTab}
          aria-label="New tab"
          title="New tab"
        >
          <PlusOutlined className="text-xs" />
        </button>

        {tabs.length >= TAB_COUNT_BADGE_MIN && (
          <Badge count={tabs.length} size="small" className="mr-1" />
        )}
      </div>

      {/* Context menu rendered via Ant Design Dropdown at click position */}
      {contextMenuTabId && contextMenuPosition && (
        <Dropdown
          menu={{ items: contextMenuItems }}
          open
          onOpenChange={(visible) => {
            if (!visible) closeContextMenu();
          }}
          trigger={['contextMenu']}
        >
          <div
            className="pointer-events-none fixed"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              width: 1,
              height: 1,
            }}
          />
        </Dropdown>
      )}
    </div>
  );
}
