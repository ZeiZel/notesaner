'use client';

import { useEffect } from 'react';
import { useLayoutStore } from '@/shared/stores/layout-store';

/**
 * useSnapLayout
 *
 * Registers the Cmd+Shift+L (Mac) / Ctrl+Shift+L (Windows/Linux) keyboard
 * shortcut that opens the snap layout picker popup.
 *
 * Mount this hook once inside a top-level client component (e.g. WorkspaceShell).
 */
export function useSnapLayout() {
  const setSnapPickerOpen = useLayoutStore((s) => s.setSnapPickerOpen);
  const isOpen = useLayoutStore((s) => s.isSnapPickerOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setSnapPickerOpen(!isOpen);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setSnapPickerOpen]);
}
