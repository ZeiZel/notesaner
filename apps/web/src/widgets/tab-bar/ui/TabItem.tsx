'use client';

/**
 * TabItem — a single draggable tab in the global tab bar.
 *
 * Renders a tab button with:
 *   - Note title (or icon-only for pinned tabs)
 *   - Dirty indicator (dot before title)
 *   - Close button (X) on hover / when active
 *   - Middle-click to close
 *   - Active state visual highlight
 *   - Drag handle via @dnd-kit/sortable
 */

import { type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CloseOutlined, PushpinFilled } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { cn } from '@/shared/lib/utils';
import type { Tab } from '@/shared/stores/tab-store';

export interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu: (event: MouseEvent, tabId: string) => void;
}

export function TabItem({ tab, isActive, onActivate, onClose, onContextMenu }: TabItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleMouseDown(event: MouseEvent) {
    // Middle-click closes the tab
    if (event.button === 1) {
      event.preventDefault();
      onClose(tab.id);
    }
  }

  function handleClick() {
    onActivate(tab.id);
  }

  function handleCloseClick(event: MouseEvent) {
    event.stopPropagation();
    onClose(tab.id);
  }

  function handleContextMenuEvent(event: MouseEvent) {
    event.preventDefault();
    onContextMenu(event, tab.id);
  }

  const isPinned = tab.isPinned;

  return (
    <Tooltip title={tab.path} placement="bottom" mouseEnterDelay={0.5}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        role="tab"
        aria-selected={isActive}
        aria-label={`${tab.title}${tab.isDirty ? ' (unsaved changes)' : ''}${tab.isPinned ? ' (pinned)' : ''}`}
        tabIndex={isActive ? 0 : -1}
        className={cn(
          'group relative flex h-full shrink-0 cursor-pointer select-none items-center border-r border-border',
          'transition-colors duration-100',
          isPinned ? 'w-9 justify-center px-1' : 'max-w-[180px] gap-1.5 px-3',
          isActive
            ? 'bg-background text-foreground'
            : 'bg-background-surface text-foreground-muted hover:bg-background hover:text-foreground',
          isDragging && 'z-50 opacity-70 shadow-md',
        )}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuEvent}
      >
        {/* Dirty indicator */}
        {tab.isDirty && !isPinned && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        )}

        {/* Pinned icon */}
        {isPinned && (
          <PushpinFilled
            className={cn('text-xs', tab.isDirty ? 'text-warning' : 'text-foreground-muted')}
          />
        )}

        {/* Title */}
        {!isPinned && <span className="truncate text-xs leading-none">{tab.title}</span>}

        {/* Close button */}
        {!isPinned && (
          <button
            type="button"
            className={cn(
              'ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors',
              'opacity-0 group-hover:opacity-100 hover:bg-foreground/10',
              isActive && 'opacity-100',
            )}
            aria-label={`Close ${tab.title}`}
            tabIndex={-1}
            onClick={handleCloseClick}
          >
            <CloseOutlined className="text-[10px]" />
          </button>
        )}

        {/* Active tab bottom border indicator */}
        {isActive && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden="true" />
        )}
      </div>
    </Tooltip>
  );
}
