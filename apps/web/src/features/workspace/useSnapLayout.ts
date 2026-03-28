'use client';

import { useEffect } from 'react';
import { useLayoutStore } from '@/shared/stores/layout-store';
import { useGridLayoutStore } from './grid-layout-store';

/**
 * useSnapLayout
 *
 * Registers global keyboard shortcuts for the workspace layout system:
 *
 * - Cmd+Shift+L (Mac) / Ctrl+Shift+L (Windows/Linux): Toggle snap layout picker
 * - Ctrl+Arrow keys: Navigate focus between grid panes
 *
 * Mount this hook once inside a top-level client component (e.g. WorkspaceShell).
 *
 * Design notes:
 *   - useEffect is valid here: subscribing to a global keyboard event
 *     (document-level, not tied to any specific component's render) is a
 *     genuine side effect that requires a global event listener.
 */
export function useSnapLayout() {
  const setSnapPickerOpen = useLayoutStore((s) => s.setSnapPickerOpen);
  const isOpen = useLayoutStore((s) => s.isSnapPickerOpen);
  const moveFocus = useGridLayoutStore((s) => s.moveFocus);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Shift + L: Toggle snap layout picker
      if (modifier && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setSnapPickerOpen(!isOpen);
        return;
      }

      // Ctrl + Arrow: Navigate focus between grid panes
      // Note: on Mac, we use Ctrl (not Cmd) for pane navigation
      // to avoid conflicting with system/browser shortcuts.
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        let direction: 'left' | 'right' | 'up' | 'down' | null = null;

        switch (e.key) {
          case 'ArrowLeft':
            direction = 'left';
            break;
          case 'ArrowRight':
            direction = 'right';
            break;
          case 'ArrowUp':
            direction = 'up';
            break;
          case 'ArrowDown':
            direction = 'down';
            break;
        }

        if (direction) {
          e.preventDefault();
          moveFocus(direction);

          // Move DOM focus to the newly focused pane
          requestAnimationFrame(() => {
            const state = useGridLayoutStore.getState();
            if (state.focusedPaneId) {
              const paneEl = document.querySelector(`[data-pane-id="${state.focusedPaneId}"]`);
              if (paneEl instanceof HTMLElement) {
                paneEl.focus({ preventScroll: true });
              }
            }
          });
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setSnapPickerOpen, moveFocus]);
}
