'use client';

/**
 * FloatingWindowsLayer — renders all open floating windows via a React portal.
 *
 * Mount this once near the root of the workspace layout (e.g. in the workspace
 * page component). It renders a `<div id="floating-windows-root">` appended to
 * `document.body` so windows float above all other content regardless of where
 * in the React tree they are opened.
 *
 * The layer itself is transparent to pointer events except on the window
 * elements themselves — it never blocks the underlying workspace.
 */

import { createPortal } from 'react-dom';
import { useFloatingWindowsStore } from '../model/floating-windows-store';
import { FloatingWindow } from './FloatingWindow';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Called by FloatingWindowsLayer for each open window.
 * Receives the window's contentType and contentProps so the caller can render
 * the appropriate component.
 *
 * Example:
 *   renderContent={(contentType, contentProps) => {
 *     if (contentType === 'outline') return <OutlinePanel {...contentProps} />;
 *     return null;
 *   }}
 */
export type FloatingWindowContentRenderer = (
  contentType: string,
  contentProps: Record<string, unknown>,
) => ReactNode;

interface FloatingWindowsLayerProps {
  /**
   * Render function called for each window's content area.
   * If omitted, windows render an "Empty window" placeholder.
   */
  renderContent?: FloatingWindowContentRenderer;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloatingWindowsLayer({ renderContent }: FloatingWindowsLayerProps) {
  const windows = useFloatingWindowsStore((s) => s.windows);

  if (typeof document === 'undefined') {
    // SSR: nothing to render
    return null;
  }

  if (windows.length === 0) {
    return null;
  }

  return createPortal(
    <div
      id="floating-windows-root"
      aria-label="Floating windows"
      className="pointer-events-none fixed inset-0 z-[100]"
    >
      {windows.map((win) => (
        <FloatingWindow key={win.id} window={win}>
          {renderContent?.(win.contentType, win.contentProps)}
        </FloatingWindow>
      ))}
    </div>,
    document.body,
  );
}
