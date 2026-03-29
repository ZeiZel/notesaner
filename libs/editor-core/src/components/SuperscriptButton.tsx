/**
 * SuperscriptButton — Toolbar button for the Superscript mark extension.
 *
 * Renders a compact toggle button that applies/removes superscript formatting
 * on the current editor selection.
 *
 * Features:
 * - Visual active state when the cursor is within superscript text
 * - Accessible: proper aria-label, aria-pressed, and title tooltip
 * - Keyboard shortcut hint shown in tooltip (Ctrl+Shift+.)
 *
 * Usage:
 * ```tsx
 * import { SuperscriptButton } from '@notesaner/editor-core';
 *
 * function FormattingToolbar({ editor }: { editor: Editor }) {
 *   return (
 *     <div>
 *       <SuperscriptButton editor={editor} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @see libs/editor-core/src/extensions/superscript.ts
 */

'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuperscriptButtonProps {
  /** The TipTap editor instance. */
  editor: Editor;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function SuperscriptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="14"
      height="14"
    >
      {/* Base "A" character */}
      <path d="M2 13L5.5 4L9 13" />
      <path d="M3.5 9.5h4" />
      {/* Superscript "2" (top-right) */}
      <path d="M11 3c0-.5.4-1 1-1s1 .4 1 1c0 .4-.3.8-.7 1.1L11 5.5h2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TOOLTIP = 'Superscript (Ctrl+Shift+.)';

/**
 * Toolbar button that toggles superscript formatting on the editor selection.
 */
export function SuperscriptButton({ editor, className }: SuperscriptButtonProps) {
  const isActive = editor.isActive('superscript');

  const handleClick = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.commands as any).toggleSuperscript?.();
  }, [editor]);

  return (
    <button
      type="button"
      className={className}
      aria-label={TOOLTIP}
      aria-pressed={isActive}
      title={TOOLTIP}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        border: 'none',
        background: isActive
          ? 'var(--ns-color-primary-muted, rgba(59, 130, 246, 0.15))'
          : 'transparent',
        color: isActive
          ? 'var(--ns-color-primary, #3b82f6)'
          : 'var(--ns-color-foreground-secondary, #6b7280)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background-color 0.1s ease, color 0.1s ease',
      }}
    >
      <SuperscriptIcon />
    </button>
  );
}

SuperscriptButton.displayName = 'SuperscriptButton';
