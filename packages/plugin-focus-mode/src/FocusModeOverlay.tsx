/**
 * FocusModeOverlay — Full-screen overlay that hides workspace chrome.
 *
 * When focus mode is active this component:
 *   1. Injects a <style> tag that hides sidebars, tab bar, and status bar.
 *   2. Adds a "focused" class to the body for host-app CSS hooks.
 *   3. Renders subtle fade gradients at the top and bottom of the viewport
 *      to ease eye strain at content boundaries.
 *   4. Registers a global ESC key listener to exit focus mode.
 *
 * The overlay itself is a portal rendered into document.body so it sits above
 * all workspace layout panels regardless of z-index stacking in the app tree.
 *
 * Props:
 *   onExit  — called when the user presses ESC or the exit button.
 *   children — the editor content area rendered inside the overlay.
 */

import React, { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_TAG_ID = 'notesaner-focus-mode-styles';
const BODY_CLASS = 'notesaner-focus-mode-active';

const FOCUS_MODE_CSS = `
/* ==========================================================
   Notesaner — Focus Mode
   Hides workspace chrome while focus mode is active.
   ========================================================== */

body.${BODY_CLASS} [data-sidebar],
body.${BODY_CLASS} [data-right-sidebar],
body.${BODY_CLASS} [data-tabbar],
body.${BODY_CLASS} [data-statusbar],
body.${BODY_CLASS} [data-topbar] {
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity 0.3s ease !important;
}

body.${BODY_CLASS} [data-editor-container] {
  transition: max-width 0.3s ease, padding 0.3s ease !important;
}
`.trim();

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FocusModeOverlayProps {
  /** Whether focus mode is currently active. */
  isActive: boolean;
  /** Whether zen mode is active (full-screen, no overlay UI). */
  isZenMode: boolean;
  /** Called when the user requests to exit focus mode. */
  onExit: () => void;
  /** Editor content to render inside the focused area. */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FocusModeOverlay manages the CSS injection lifecycle and keyboard shortcut
 * for exiting focus mode. It does not render visible DOM nodes itself — it
 * delegates that to its children and to sibling components (FocusToolbar,
 * SessionStats, etc.).
 */
export function FocusModeOverlay({
  isActive,
  isZenMode: _isZenMode,
  onExit,
  children,
}: FocusModeOverlayProps): React.ReactElement | null {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // ---- CSS injection ----
  useEffect(() => {
    if (!isActive) {
      // Remove styles and body class when deactivating
      document.body.classList.remove(BODY_CLASS);
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
      return;
    }

    // Inject styles
    let style = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_TAG_ID;
      style.textContent = FOCUS_MODE_CSS;
      document.head.appendChild(style);
    }
    styleRef.current = style;
    document.body.classList.add(BODY_CLASS);

    return () => {
      document.body.classList.remove(BODY_CLASS);
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, [isActive]);

  // ---- ESC key listener ----
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onExit]);

  if (!isActive) return null;

  return (
    <>
      {/* Top fade gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          background:
            'linear-gradient(to bottom, var(--color-bg, rgba(255,255,255,0.95)), transparent)',
          pointerEvents: 'none',
          zIndex: 9990,
        }}
      />

      {/* Bottom fade gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background:
            'linear-gradient(to top, var(--color-bg, rgba(255,255,255,0.95)), transparent)',
          pointerEvents: 'none',
          zIndex: 9990,
        }}
      />

      {/* Children (toolbar, stats, etc.) */}
      {children}
    </>
  );
}
