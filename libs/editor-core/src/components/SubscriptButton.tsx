/**
 * SubscriptButton — Toolbar button for the Subscript mark extension.
 *
 * Renders a compact toggle button that applies/removes subscript formatting
 * on the current editor selection.
 *
 * Features:
 * - Visual active state when the cursor is within subscript text
 * - Accessible: proper aria-label, aria-pressed, and title tooltip
 * - Keyboard shortcut hint shown in tooltip (Ctrl+Shift+,)
 *
 * Usage:
 * ```tsx
 * import { SubscriptButton } from '@notesaner/editor-core';
 *
 * function FormattingToolbar({ editor }: { editor: Editor }) {
 *   return (
 *     <div>
 *       <SubscriptButton editor={editor} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @see libs/editor-core/src/extensions/subscript.ts
 */

'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptButtonProps {
  /** The TipTap editor instance. */
  editor: Editor;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function SubscriptIcon({ className }: { className?: string }) {
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
      <path d="M2 12L5.5 3L9 12" />
      <path d="M3.5 8.5h4" />
      {/* Subscript "2" (bottom-right) */}
      <path d="M11 11c0-.5.4-1 1-1s1 .4 1 1c0 .4-.3.8-.7 1.1L11 13.5h2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TOOLTIP = 'Subscript (Ctrl+Shift+,)';

/**
 * Toolbar button that toggles subscript formatting on the editor selection.
 */
export function SubscriptButton({ editor, className }: SubscriptButtonProps) {
  const isActive = editor.isActive('subscript');

  const handleClick = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.commands as any).toggleSubscript?.();
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
      <SubscriptIcon />
    </button>
  );
}

SubscriptButton.displayName = 'SubscriptButton';
