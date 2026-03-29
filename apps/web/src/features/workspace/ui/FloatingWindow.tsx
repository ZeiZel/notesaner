'use client';

/**
 * FloatingWindow — a draggable, resizable floating window component.
 *
 * Features:
 *   - Drag by title bar to reposition. Snaps to viewport edges.
 *   - Resize by dragging any of 8 resize handles (corners + edges).
 *   - Title bar controls: minimize, maximize, close.
 *   - Z-index management via floating-windows-store (click-to-focus).
 *   - Content rendered via a render-prop for full flexibility.
 *   - No useEffect: all interaction via pointer event handlers.
 *   - Accessible: title bar has role="toolbar", resize handles have aria-labels.
 *
 * Design notes:
 *   - Uses `position: fixed` so it always floats above the workspace grid.
 *   - Min/max size constraints are enforced in the store.
 *   - Drag and resize logic uses raw pointer events captured at the window level
 *     to avoid losing track during fast moves. pointerId capture ensures
 *     we keep tracking even when the pointer leaves the handle.
 */

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  useFloatingWindowsStore,
  type FloatingWindow as FloatingWindowData,
  type FloatingWindowPosition,
  type FloatingWindowSize,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
} from '../model/floating-windows-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resize directions for the 8 handles around the window border. */
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface FloatingWindowProps {
  /** Window data from the store. */
  window: FloatingWindowData;
  /** Content to render inside the window body. */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// TitleBarButton — small icon button in the title bar
// ---------------------------------------------------------------------------

interface TitleBarButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'close';
}

function TitleBarButton({ label, icon, onClick, variant = 'default' }: TitleBarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        variant === 'close'
          ? 'text-muted-foreground hover:bg-destructive hover:text-destructive-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TitleBarIcons
// ---------------------------------------------------------------------------

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M2 8a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8z" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M4.75 4.5a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25h-6.5zM2 4.75C2 3.784 2.784 3 3.75 3h8.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0112.25 13h-8.5A1.75 1.75 0 012 11.25v-6.5z" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M5.5 3.5A1.5 1.5 0 017 2h5.5A1.5 1.5 0 0114 3.5V9a1.5 1.5 0 01-1.5 1.5H11V9a3 3 0 00-3-3H5.5V3.5z" />
      <path d="M2 6.75C2 5.784 2.784 5 3.75 5h5.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 019.25 14h-5.5A1.75 1.75 0 012 12.25v-5.5zm1.75-.25a.25.25 0 00-.25.25v5.5c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25v-5.5a.25.25 0 00-.25-.25h-5.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function DetachIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M3.75 2A1.75 1.75 0 002 3.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25V8.5a.75.75 0 00-1.5 0v3.75a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25H8A.75.75 0 008 2H3.75z" />
      <path d="M10 2.75a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0V4.56L8.78 8.78a.75.75 0 01-1.06-1.06L11.94 3.5h-1.19a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ResizeHandle — invisible draggable edge/corner
// ---------------------------------------------------------------------------

interface ResizeHandleProps {
  direction: ResizeDirection;
  onResizeStart: (direction: ResizeDirection, e: ReactPointerEvent<HTMLDivElement>) => void;
}

const HANDLE_CLASSES: Record<ResizeDirection, string> = {
  n: 'top-0 left-2 right-2 h-1.5 cursor-n-resize',
  s: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize',
  e: 'right-0 top-2 bottom-2 w-1.5 cursor-e-resize',
  w: 'left-0 top-2 bottom-2 w-1.5 cursor-w-resize',
  ne: 'top-0 right-0 h-3 w-3 cursor-ne-resize',
  nw: 'top-0 left-0 h-3 w-3 cursor-nw-resize',
  se: 'bottom-0 right-0 h-3 w-3 cursor-se-resize',
  sw: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize',
};

function ResizeHandle({ direction, onResizeStart }: ResizeHandleProps) {
  return (
    <div
      aria-label={`Resize ${direction}`}
      className={cn('absolute z-10', HANDLE_CLASSES[direction])}
      onPointerDown={(e) => onResizeStart(direction, e)}
    />
  );
}

// ---------------------------------------------------------------------------
// FloatingWindow
// ---------------------------------------------------------------------------

export function FloatingWindow({ window: win, children }: FloatingWindowProps) {
  const updatePosition = useFloatingWindowsStore((s) => s.updatePosition);
  const updateSize = useFloatingWindowsStore((s) => s.updateSize);
  const focusWindow = useFloatingWindowsStore((s) => s.focusWindow);
  const closeWindow = useFloatingWindowsStore((s) => s.closeWindow);
  const toggleMinimize = useFloatingWindowsStore((s) => s.toggleMinimize);
  const toggleMaximize = useFloatingWindowsStore((s) => s.toggleMaximize);

  // Refs for drag/resize tracking (no state — avoids re-renders during drag)
  const dragStartPointer = useRef<{ px: number; py: number } | null>(null);
  const dragStartPos = useRef<FloatingWindowPosition>({ x: 0, y: 0 });

  const resizeStartPointer = useRef<{ px: number; py: number } | null>(null);
  const resizeStartPos = useRef<FloatingWindowPosition>({ x: 0, y: 0 });
  const resizeStartSize = useRef<FloatingWindowSize>({ width: 0, height: 0 });
  const activeResizeDir = useRef<ResizeDirection | null>(null);

  // -------------------------------------------------------------------------
  // Focus on interaction
  // -------------------------------------------------------------------------

  const handlePointerDown = useCallback(() => {
    focusWindow(win.id);
  }, [win.id, focusWindow]);

  // -------------------------------------------------------------------------
  // Title-bar drag
  // -------------------------------------------------------------------------

  const handleTitleBarPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only start drag from left mouse button or single touch
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (win.isMaximized) return;

      focusWindow(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);

      dragStartPointer.current = { px: e.clientX, py: e.clientY };
      dragStartPos.current = { ...win.position };
    },
    [win.id, win.position, win.isMaximized, focusWindow],
  );

  const handleTitleBarPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStartPointer.current) return;

      const dx = e.clientX - dragStartPointer.current.px;
      const dy = e.clientY - dragStartPointer.current.py;

      updatePosition(win.id, {
        x: dragStartPos.current.x + dx,
        y: dragStartPos.current.y + dy,
      });
    },
    [win.id, updatePosition],
  );

  const handleTitleBarPointerUp = useCallback(() => {
    dragStartPointer.current = null;
  }, []);

  // -------------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------------

  const handleResizeStart = useCallback(
    (direction: ResizeDirection, e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      focusWindow(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();

      resizeStartPointer.current = { px: e.clientX, py: e.clientY };
      resizeStartPos.current = { ...win.position };
      resizeStartSize.current = { ...win.size };
      activeResizeDir.current = direction;
    },
    [win.id, win.position, win.size, focusWindow],
  );

  const handleResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeStartPointer.current || !activeResizeDir.current) return;

      const dx = e.clientX - resizeStartPointer.current.px;
      const dy = e.clientY - resizeStartPointer.current.py;
      const dir = activeResizeDir.current;
      const startPos = resizeStartPos.current;
      const startSize = resizeStartSize.current;

      let newX = startPos.x;
      let newY = startPos.y;
      let newW = startSize.width;
      let newH = startSize.height;

      // Horizontal resizing
      if (dir.includes('e')) {
        newW = Math.max(MIN_WINDOW_WIDTH, startSize.width + dx);
      }
      if (dir.includes('w')) {
        const proposedW = Math.max(MIN_WINDOW_WIDTH, startSize.width - dx);
        newX = startPos.x + (startSize.width - proposedW);
        newW = proposedW;
      }

      // Vertical resizing
      if (dir.includes('s')) {
        newH = Math.max(MIN_WINDOW_HEIGHT, startSize.height + dy);
      }
      if (dir.includes('n')) {
        const proposedH = Math.max(MIN_WINDOW_HEIGHT, startSize.height - dy);
        newY = startPos.y + (startSize.height - proposedH);
        newH = proposedH;
      }

      updateSize(win.id, { width: newW, height: newH });
      updatePosition(win.id, { x: newX, y: newY });
    },
    [win.id, updateSize, updatePosition],
  );

  const handleResizePointerUp = useCallback(() => {
    resizeStartPointer.current = null;
    activeResizeDir.current = null;
  }, []);

  // -------------------------------------------------------------------------
  // Derived styles
  // -------------------------------------------------------------------------

  const windowStyle: React.CSSProperties = win.isMaximized
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: win.zIndex + 1000, // maximize floats above everything
      }
    : {
        position: 'fixed',
        top: win.position.y,
        left: win.position.x,
        width: win.isMinimized ? win.size.width : win.size.width,
        height: win.isMinimized ? 'auto' : win.size.height,
        zIndex: win.zIndex,
      };

  return (
    <div
      data-floating-window-id={win.id}
      style={windowStyle}
      onPointerDown={handlePointerDown}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-floating',
        'select-none',
        // Smooth transition for maximize/minimize toggle, not during drag
        !dragStartPointer.current &&
          !resizeStartPointer.current &&
          'transition-shadow duration-150',
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Title bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="toolbar"
        aria-label={`Window: ${win.title}`}
        onPointerDown={handleTitleBarPointerDown}
        onPointerMove={handleTitleBarPointerMove}
        onPointerUp={handleTitleBarPointerUp}
        onPointerCancel={handleTitleBarPointerUp}
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 border-b border-border/60 px-2',
          'bg-muted/40',
          !win.isMaximized ? 'cursor-move' : 'cursor-default',
        )}
      >
        {/* Window icon */}
        <DetachIcon />

        {/* Title */}
        <span className="flex-1 truncate text-xs font-medium text-foreground select-none">
          {win.title}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <TitleBarButton
            label={win.isMinimized ? 'Restore window' : 'Minimize window'}
            icon={win.isMinimized ? <RestoreIcon /> : <MinimizeIcon />}
            onClick={() => toggleMinimize(win.id)}
          />
          <TitleBarButton
            label={win.isMaximized ? 'Restore window' : 'Maximize window'}
            icon={win.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            onClick={() => toggleMaximize(win.id)}
          />
          <TitleBarButton
            label="Close window"
            icon={<CloseIcon />}
            onClick={() => closeWindow(win.id)}
            variant="close"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content area — hidden when minimized                               */}
      {/* ------------------------------------------------------------------ */}
      {!win.isMinimized && (
        <div className="flex-1 min-h-0 overflow-auto">
          {children ?? (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Empty window
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Resize handles — hidden when maximized                             */}
      {/* ------------------------------------------------------------------ */}
      {!win.isMaximized && !win.isMinimized && (
        <div
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          className="pointer-events-none absolute inset-0"
        >
          {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeDirection[]).map((dir) => (
            <ResizeHandle key={dir} direction={dir} onResizeStart={handleResizeStart} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetachButton — rendered inside existing panels to open a floating window
// ---------------------------------------------------------------------------

interface DetachButtonProps {
  /** Title for the new floating window. */
  title: string;
  /** Content type that matches PanelRegistry IDs. */
  contentType: string;
  /** Optional props forwarded to the content component. */
  contentProps?: Record<string, unknown>;
  /** Additional class names. */
  className?: string;
}

/**
 * A small button rendered in panel headers to detach the panel into a
 * floating window.
 *
 * Usage:
 *   <DetachButton title="Outline" contentType="outline" />
 */
export function DetachButton({ title, contentType, contentProps, className }: DetachButtonProps) {
  const openWindow = useFloatingWindowsStore((s) => s.openWindow);

  const handleDetach = useCallback(() => {
    openWindow({ title, contentType, contentProps: contentProps ?? {} });
  }, [title, contentType, contentProps, openWindow]);

  return (
    <button
      type="button"
      aria-label={`Detach ${title} to floating window`}
      title={`Open ${title} in floating window`}
      onClick={handleDetach}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      <DetachIcon />
    </button>
  );
}
