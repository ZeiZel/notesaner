'use client';

/**
 * PanelControls — maximize/minimize/restore controls for workspace panels.
 *
 * Renders small icon buttons in the panel header area that allow:
 *   - Maximize: panel fills the entire workspace, other panels hidden.
 *   - Minimize: panel collapses to a thin header-only strip.
 *   - Restore: returns to the previous (normal) size.
 *
 * Keyboard shortcuts:
 *   - Mod+Shift+M: toggle maximize for the focused pane.
 *   - Mod+Shift+.: toggle minimize for the focused pane.
 *
 * Design:
 *   - All state lives in usePanelControlsStore (Zustand).
 *   - No useEffect: state transitions via event handlers.
 *   - The GridPane component reads panel state to apply CSS overrides.
 */

import { useCallback } from 'react';
import { usePanelControlsStore } from '../panel-controls-store';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PanelControlsProps {
  /** The pane ID this control set belongs to. */
  paneId: string;
  /** Additional CSS classes for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M2 8a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Control button
// ---------------------------------------------------------------------------

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

function ControlButton({ icon, label, onClick, isActive }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isActive
          ? 'bg-primary/15 text-primary hover:bg-primary/25'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PanelControls({ paneId, className }: PanelControlsProps) {
  const panelState = usePanelControlsStore((s) => s.panelStates[paneId] ?? 'normal');
  const maximize = usePanelControlsStore((s) => s.maximize);
  const minimize = usePanelControlsStore((s) => s.minimize);
  const restore = usePanelControlsStore((s) => s.restore);

  const handleMaximize = useCallback(() => {
    if (panelState === 'maximized') {
      restore(paneId);
    } else {
      maximize(paneId);
    }
  }, [panelState, paneId, maximize, restore]);

  const handleMinimize = useCallback(() => {
    if (panelState === 'minimized') {
      restore(paneId);
    } else {
      minimize(paneId);
    }
  }, [panelState, paneId, minimize, restore]);

  const handleRestore = useCallback(() => {
    restore(paneId);
  }, [paneId, restore]);

  const isNormal = panelState === 'normal';
  const isMaximized = panelState === 'maximized';
  const isMinimized = panelState === 'minimized';

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {/* Restore button — shown when not in normal state */}
      {!isNormal && (
        <ControlButton
          icon={<RestoreIcon />}
          label="Restore panel"
          onClick={handleRestore}
          isActive
        />
      )}

      {/* Minimize button — shown when not already minimized */}
      {!isMinimized && (
        <ControlButton icon={<MinimizeIcon />} label="Minimize panel" onClick={handleMinimize} />
      )}

      {/* Maximize button — shown when not already maximized */}
      {!isMaximized && (
        <ControlButton icon={<MaximizeIcon />} label="Maximize panel" onClick={handleMaximize} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook for keyboard shortcut integration
// ---------------------------------------------------------------------------

/**
 * Returns shortcut handlers for panel maximize/minimize actions.
 * Integrate with useKeyboardShortcuts from the focused pane.
 */
export function usePanelControlShortcuts(focusedPaneId: string | null): {
  'toggle-maximize-pane': () => void;
  'toggle-minimize-pane': () => void;
} {
  const store = usePanelControlsStore();

  const toggleMaximize = useCallback(() => {
    if (!focusedPaneId) return;
    const currentState = store.panelStates[focusedPaneId] ?? 'normal';
    if (currentState === 'maximized') {
      store.restore(focusedPaneId);
    } else {
      store.maximize(focusedPaneId);
    }
  }, [focusedPaneId, store]);

  const toggleMinimize = useCallback(() => {
    if (!focusedPaneId) return;
    const currentState = store.panelStates[focusedPaneId] ?? 'normal';
    if (currentState === 'minimized') {
      store.restore(focusedPaneId);
    } else {
      store.minimize(focusedPaneId);
    }
  }, [focusedPaneId, store]);

  return {
    'toggle-maximize-pane': toggleMaximize,
    'toggle-minimize-pane': toggleMinimize,
  };
}
