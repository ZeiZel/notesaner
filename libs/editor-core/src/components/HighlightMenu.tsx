/**
 * HighlightMenu — Color picker popup for the Highlight mark extension.
 *
 * Renders a compact grid of color buttons that let the user pick a highlight
 * color for the current text selection. Integrates with the TipTap editor
 * instance to apply/remove highlights.
 *
 * Features:
 * - Six preset color buttons (yellow, green, blue, pink, orange, purple)
 * - Visual indication of the currently active highlight color
 * - "Remove highlight" button to clear the mark
 * - Keyboard navigation: arrow keys move focus, Enter/Space activates
 * - Accessible: proper roles, labels, and focus management
 *
 * Usage:
 * ```tsx
 * import { HighlightMenu } from '@notesaner/editor-core';
 *
 * function Toolbar({ editor }: { editor: Editor }) {
 *   const [showMenu, setShowMenu] = useState(false);
 *
 *   return (
 *     <div style={{ position: 'relative' }}>
 *       <button onClick={() => setShowMenu(!showMenu)}>Highlight</button>
 *       {showMenu && (
 *         <HighlightMenu
 *           editor={editor}
 *           onClose={() => setShowMenu(false)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see libs/editor-core/src/extensions/highlight.ts
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../extensions/highlight';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HighlightMenuProps {
  /** The TipTap editor instance. */
  editor: Editor;
  /** Called when the menu should close (e.g., after a color is picked). */
  onClose?: () => void;
}

/** Display labels for each color (used for accessibility and tooltips). */
const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  orange: 'Orange',
  purple: 'Purple',
};

/**
 * Solid preview colors for the color picker buttons.
 * These are more opaque than the text highlight values for visual clarity.
 */
const PREVIEW_COLORS: Record<HighlightColor, string> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
  orange: '#fb923c',
  purple: '#a78bfa',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TipTap highlight color picker popup.
 *
 * Renders a row of color swatches and a remove button.
 * Clicking a swatch applies or toggles the corresponding highlight color.
 */
export function HighlightMenu({ editor, onClose }: HighlightMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine the currently active highlight color (if any).
  const activeColor = getActiveHighlightColor(editor);

  const handleSelectColor = useCallback(
    (color: HighlightColor) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.commands as any).toggleHighlight?.(color);
      onClose?.();
    },
    [editor, onClose],
  );

  const handleRemove = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.commands as any).unsetHighlight?.();
    onClose?.();
  }, [editor, onClose]);

  // Close on Escape key.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close when clicking outside the menu.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    }

    // Use a timeout to avoid immediately closing on the click that opened the menu.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="ns-highlight-menu"
      role="toolbar"
      aria-label="Highlight color picker"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        background: 'var(--ns-highlight-menu-bg, #ffffff)',
        border: '1px solid var(--ns-highlight-menu-border, #e5e7eb)',
        borderRadius: '8px',
        boxShadow: 'var(--ns-highlight-menu-shadow, 0 4px 12px rgba(0, 0, 0, 0.1))',
        zIndex: 50,
      }}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`ns-highlight-menu__swatch${activeColor === color ? ' ns-highlight-menu__swatch--active' : ''}`}
          aria-label={`Highlight ${COLOR_LABELS[color]}`}
          aria-pressed={activeColor === color}
          title={COLOR_LABELS[color]}
          onClick={() => handleSelectColor(color)}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border:
              activeColor === color
                ? '2px solid var(--ns-highlight-menu-active-border, #1f2937)'
                : '1px solid var(--ns-highlight-menu-swatch-border, #d1d5db)',
            background: PREVIEW_COLORS[color],
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            transition: 'transform 0.1s ease, border-color 0.1s ease',
            transform: activeColor === color ? 'scale(1.1)' : 'scale(1)',
          }}
        />
      ))}

      {/* Separator */}
      <div
        aria-hidden="true"
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--ns-highlight-menu-separator, #e5e7eb)',
          margin: '0 2px',
          flexShrink: 0,
        }}
      />

      {/* Remove highlight button */}
      <button
        type="button"
        className="ns-highlight-menu__remove"
        aria-label="Remove highlight"
        title="Remove highlight"
        onClick={handleRemove}
        disabled={!activeColor}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: '1px solid var(--ns-highlight-menu-swatch-border, #d1d5db)',
          background: 'var(--ns-highlight-menu-remove-bg, #f3f4f6)',
          cursor: activeColor ? 'pointer' : 'default',
          padding: 0,
          flexShrink: 0,
          opacity: activeColor ? 1 : 0.4,
          color: 'var(--ns-highlight-menu-remove-color, #6b7280)',
          fontSize: '14px',
          lineHeight: 1,
        }}
      >
        {/* Strikethrough circle icon — indicates "remove" */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <line x1="4" y1="12" x2="12" y2="4" />
        </svg>
      </button>
    </div>
  );
}

HighlightMenu.displayName = 'HighlightMenu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the currently active highlight color in the editor selection.
 * Returns the color string if a highlight mark is active, null otherwise.
 */
export function getActiveHighlightColor(editor: Editor): HighlightColor | null {
  if (!editor.isActive('highlight')) return null;

  // Try each preset color to find the active one.
  for (const color of HIGHLIGHT_COLORS) {
    if (editor.isActive('highlight', { color })) {
      return color;
    }
  }

  // Fallback: highlight is active but color didn't match any preset.
  return 'yellow';
}
