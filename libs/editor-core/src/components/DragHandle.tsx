/**
 * DragHandle — React wrapper for the block drag handle feature.
 *
 * This component injects the global CSS required by the DragHandle extension
 * and exports a helper hook (`useDragHandleStyles`) for dynamically loading
 * those styles when using CSS-in-JS or style injection strategies.
 *
 * The extension itself manages all DOM interaction.  This component is purely
 * a convenience for:
 *   1. Importing the static CSS variables / keyframes in one place.
 *   2. Providing a `DragHandleStyles` component that injects a `<style>` tag
 *      into the document head (useful for Next.js / SSR setups that cannot
 *      import .css files directly from a library).
 *
 * Usage with a global CSS file:
 * ```ts
 * // In your app's globals.css or editor CSS bundle:
 * import '@notesaner/editor-core/drag-handle.css';
 * // OR use the DragHandleStyles component.
 * ```
 *
 * Usage with the component:
 * ```tsx
 * import { DragHandleStyles } from '@notesaner/editor-core';
 *
 * // Somewhere near the root of your app:
 * <DragHandleStyles />
 * ```
 *
 * CSS variables that can be themed:
 *   --ns-drag-handle-color        — icon color (default: #9ca3af / gray-400)
 *   --ns-drag-handle-hover-color  — icon color on hover (default: #6b7280 / gray-500)
 *   --ns-drag-handle-bg-hover     — background on hover (default: rgba(0,0,0,0.04))
 *   --ns-drag-handle-size         — handle element size (default: 20px)
 *   --ns-drop-indicator-color     — drop line color (default: #3b82f6 / blue-500)
 *   --ns-drop-indicator-height    — drop line thickness (default: 2px)
 */

'use client';

import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Static CSS for the drag handle and drop indicator
// ---------------------------------------------------------------------------

/**
 * Returns the CSS string that styles the drag handle button and drop indicator.
 * This is extracted as a function so it can be used both at module level (for
 * injecting into a <style> tag) and exported for consumption in CSS-in-JS.
 */
export function getDragHandleCss(): string {
  return `
/* ============================================================
   Notesaner — Drag Handle Extension Styles
   Inject via <DragHandleStyles /> or import from your CSS bundle.
   ============================================================ */

:root {
  --ns-drag-handle-color: #9ca3af;
  --ns-drag-handle-hover-color: #6b7280;
  --ns-drag-handle-bg-hover: rgba(0, 0, 0, 0.04);
  --ns-drag-handle-size: 20px;
  --ns-drop-indicator-color: #3b82f6;
  --ns-drop-indicator-height: 2px;
}

/* Dark-mode token overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --ns-drag-handle-color: #6b7280;
    --ns-drag-handle-hover-color: #9ca3af;
    --ns-drag-handle-bg-hover: rgba(255, 255, 255, 0.06);
    --ns-drop-indicator-color: #60a5fa;
  }
}

/* ----- Handle element ----- */
.ns-drag-handle {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ns-drag-handle-size);
  height: var(--ns-drag-handle-size);
  padding: 2px;
  border-radius: 4px;
  cursor: grab;
  color: var(--ns-drag-handle-color);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease, color 120ms ease, background-color 120ms ease;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  z-index: 20;
}

.ns-drag-handle--visible {
  opacity: 1;
  pointer-events: auto;
}

.ns-drag-handle:hover,
.ns-drag-handle--active {
  color: var(--ns-drag-handle-hover-color);
  background-color: var(--ns-drag-handle-bg-hover);
}

.ns-drag-handle--active {
  cursor: grabbing;
  opacity: 1;
  pointer-events: auto;
}

/* ----- Drop indicator line ----- */
.ns-drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--ns-drop-indicator-height);
  background-color: var(--ns-drop-indicator-color);
  border-radius: 1px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 80ms ease;
  z-index: 30;
}

/* Add circular "cap" dots on both ends of the line */
.ns-drop-indicator::before,
.ns-drop-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--ns-drop-indicator-color);
}

.ns-drop-indicator::before {
  left: 0;
}

.ns-drop-indicator::after {
  right: 0;
}

.ns-drop-indicator--visible {
  opacity: 1;
}
`.trim();
}

// ---------------------------------------------------------------------------
// DragHandleStyles component
// ---------------------------------------------------------------------------

/**
 * Injects the drag handle CSS into the document `<head>` via a `<style>` tag.
 *
 * Mount this component once near the root of your app (or inside the component
 * that renders the TipTap editor) to ensure the styles are available.
 *
 * Idempotent — if the style tag already exists (e.g., due to hot-reload or
 * duplicate mounts), a second tag is not added.
 *
 * @example
 * ```tsx
 * // In your root layout or NoteEditor component:
 * import { DragHandleStyles } from '@notesaner/editor-core';
 *
 * export function NoteEditor() {
 *   return (
 *     <>
 *       <DragHandleStyles />
 *       {/* ... editor ... *\/}
 *     </>
 *   );
 * }
 * ```
 */
export function DragHandleStyles(): null {
  useEffect(() => {
    const STYLE_ID = 'ns-drag-handle-styles';

    // Idempotency check
    if (document.getElementById(STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = getDragHandleCss();
    document.head.appendChild(styleEl);

    return () => {
      // Only remove if this effect was the one that added the tag.
      const el = document.getElementById(STYLE_ID);
      if (el) el.remove();
    };
  }, []);

  return null;
}

DragHandleStyles.displayName = 'DragHandleStyles';

// ---------------------------------------------------------------------------
// useDragHandleStyles hook
// ---------------------------------------------------------------------------

/**
 * React hook that injects drag handle CSS on mount.
 *
 * Use this inside a component that renders inside a TipTap editor so the
 * styles are scoped to the editor's lifetime.
 *
 * @example
 * ```tsx
 * function NoteEditorWrapper() {
 *   useDragHandleStyles();
 *   return <EditorContent editor={editor} />;
 * }
 * ```
 */
export function useDragHandleStyles(): void {
  useEffect(() => {
    const STYLE_ID = 'ns-drag-handle-styles';
    if (document.getElementById(STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = getDragHandleCss();
    document.head.appendChild(styleEl);

    return () => {
      const el = document.getElementById(STYLE_ID);
      if (el) el.remove();
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Exports for consumer convenience
// ---------------------------------------------------------------------------

export type { DragHandleOptions } from '../extensions/drag-handle';
export { DragHandle, DRAG_HANDLE_PLUGIN_KEY } from '../extensions/drag-handle';
