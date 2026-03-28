'use client';

/**
 * QuickCaptureProvider — App-level component that:
 *  1. Registers the Cmd+Shift+N keyboard shortcut
 *  2. Renders the QuickCaptureModal (always mounted but hidden via Modal open prop)
 *
 * Mount this inside the root Providers so it's available on every page.
 */

import { useKeyboardShortcut } from '@/shared/hooks/useKeyboardShortcut';
import { useQuickCaptureStore } from '../model/quick-capture-store';
import { QuickCaptureModal } from './QuickCaptureModal';

export function QuickCaptureProvider() {
  const open = useQuickCaptureStore((s) => s.open);

  // Register the global Cmd+Shift+N shortcut
  useKeyboardShortcut('quick-capture', 'global', open);

  return <QuickCaptureModal />;
}
