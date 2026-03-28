/**
 * TabBar.tsx
 *
 * Global horizontal tab bar showing all open note buffers.
 *
 * Features:
 *   - Drag-to-reorder tabs via @dnd-kit
 *   - Close button per tab with dirty indicator (dot)
 *   - Middle-click to close
 *   - Active tab highlighting
 *   - Right-click context menu (close, close others, close to right, close all, pin/unpin)
 *   - Tab overflow: horizontal scroll with arrow buttons and dropdown for hidden tabs
 *   - Keyboard navigation: arrow keys to switch tabs
 *
 * Design notes:
 *   - No useEffect for derived state -- all computed at render time.
 *   - Tab list is read from the global tab store.
 *   - DnD is scoped to the tab bar (own DndContext to avoid conflicting with sidebar DnD).
 */

'use client';

import { useState, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, ChevronsUpDown, X, Pin } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useTabStore, type Tab } from '@/shared/stores/tab-store';

// ---------------------------------------------------------------------------
// Context Menu
// ---------------------------------------------------------------------------

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

function TabContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === menu.tabId));
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeToTheRight = useTabStore((s) => s.closeToTheRight);
  const closeAll = useTabStore((s) => s.closeAll);
  const togglePinTab = useTabStore((s) => s.togglePinTab);

  if (!tab) return null;

  const items = [
    {
      label: 'Close',
      action: () => closeTab(menu.tabId),
      shortcut: undefined,
    },
    {
      label: 'Close Others',
      action: () => closeOthers(menu.tabId),
      shortcut: undefined,
    },
    {
      label: 'Close to the Right',
      action: () => closeToTheRight(menu.tabId),
      shortcut: undefined,
    },
    {
      label: 'Close All',
      action: () => closeAll(),
      shortcut: undefined,
    },
    { label: 'separator' as const, action: () => {}, shortcut: undefined },
    {
      label: tab.isPinned ? 'Unpin Tab' : 'Pin Tab',
      action: () => togglePinTab(menu.tabId),
      shortcut: undefined,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden="true" />
      {/* Menu */}
      <div
        role="menu"
        className="fixed z-[61] min-w-44 rounded-md border border-border bg-background-surface p-1 shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {items.map((item, i) =>
          item.label === 'separator' ? (
            <div key={`sep-${i}`} className="my-1 h-px bg-border" role="separator" />
          ) : (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                item.action();
                onClose();
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sortable Tab Item
// ---------------------------------------------------------------------------

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu: (tabId: string, e: ReactMouseEvent) => void;
}

function SortableTab({ tab, isActive, onActivate, onClose, onContextMenu }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      // Middle click to close
      if (e.button === 1) {
        e.preventDefault();
        onClose(tab.id);
      }
    },
    [onClose, tab.id],
  );

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      onContextMenu(tab.id, e);
    },
    [onContextMenu, tab.id],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onActivate(tab.id)}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      title={tab.path}
      className={cn(
        'group relative flex h-full max-w-48 shrink-0 cursor-pointer items-center gap-1 border-r border-border px-3 text-xs transition-colors select-none',
        isActive
          ? 'bg-background text-foreground'
          : 'bg-background-surface text-foreground-muted hover:bg-secondary/50 hover:text-foreground',
        isDragging && 'opacity-50',
      )}
    >
      {/* Pin indicator */}
      {tab.isPinned && <Pin className="h-2.5 w-2.5 shrink-0 text-primary/60" aria-hidden="true" />}

      {/* Title */}
      <span className="truncate">{tab.title}</span>

      {/* Dirty indicator / Close button */}
      <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center">
        {tab.isDirty ? (
          // Dirty dot -- becomes close button on hover
          <>
            <span
              className="block h-1.5 w-1.5 rounded-full bg-foreground-muted group-hover:hidden"
              aria-label="Unsaved changes"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={`Close ${tab.title}`}
              className="hidden h-4 w-4 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground group-hover:flex"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          // Close button (visible on hover)
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            aria-label={`Close ${tab.title}`}
            className="hidden h-4 w-4 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground group-hover:flex"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>

      {/* Active tab bottom border indicator */}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" aria-hidden="true" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Overflow Dropdown
// ---------------------------------------------------------------------------

function TabOverflowDropdown({
  tabs,
  activeTabId,
  onActivate,
}: {
  tabs: Tab[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (tabs.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Show all ${tabs.length} open tabs`}
        aria-expanded={isOpen}
        className="flex h-full items-center px-1.5 text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronsUpDown className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-[61] mt-0.5 max-h-64 min-w-56 overflow-y-auto rounded-md border border-border bg-background-surface p-1 shadow-lg"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="menuitem"
                onClick={() => {
                  onActivate(tab.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary',
                  tab.id === activeTabId
                    ? 'bg-secondary/50 text-foreground'
                    : 'text-foreground-muted',
                )}
              >
                {tab.isPinned && <Pin className="h-2.5 w-2.5 shrink-0 text-primary/60" />}
                <span className="truncate">{tab.title}</span>
                {tab.isDirty && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-foreground-muted" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TabBar Component
// ---------------------------------------------------------------------------

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // DnD sensors scoped to tab bar
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = tabs.findIndex((t) => t.id === active.id);
      const toIndex = tabs.findIndex((t) => t.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderTabs(fromIndex, toIndex);
      }
    },
    [tabs, reorderTabs],
  );

  const handleContextMenu = useCallback((tabId: string, e: ReactMouseEvent) => {
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  const scrollLeft = useCallback(() => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  // Handle keyboard navigation within the tab bar
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (tabs.length === 0) return;

      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        setActiveTab(tabs[nextIndex].id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        setActiveTab(tabs[prevIndex].id);
      }
    },
    [tabs, activeTabId, setActiveTab],
  );

  // Don't render if there are no tabs
  if (tabs.length === 0) return null;

  const tabIds = tabs.map((t) => t.id);

  return (
    <div
      className="flex h-8 items-stretch border-b border-border bg-background-surface"
      role="tablist"
      aria-label="Open notes"
      onKeyDown={handleKeyDown}
    >
      {/* Scroll left button */}
      <button
        onClick={scrollLeft}
        aria-label="Scroll tabs left"
        className="flex w-6 shrink-0 items-center justify-center text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Scrollable tab area */}
      <div ref={scrollRef} className="flex flex-1 items-stretch overflow-x-auto scrollbar-none">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={setActiveTab}
                onClose={closeTab}
                onContextMenu={handleContextMenu}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Scroll right button */}
      <button
        onClick={scrollRight}
        aria-label="Scroll tabs right"
        className="flex w-6 shrink-0 items-center justify-center text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Overflow dropdown */}
      <TabOverflowDropdown tabs={tabs} activeTabId={activeTabId} onActivate={setActiveTab} />

      {/* Context menu */}
      {contextMenu !== null && (
        <TabContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
