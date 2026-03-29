/**
 * HorizontalRuleButton — Toolbar button for inserting horizontal rules.
 *
 * Renders a compact button that inserts a horizontal rule at the current
 * cursor position in the TipTap editor.
 *
 * Features:
 * - Visual active state when cursor is on a horizontal rule node
 * - Optional style selector to choose thin | thick | dashed variant
 * - Accessible: proper aria-label, aria-pressed, and title tooltip
 * - Keyboard shortcut hint shown in tooltip (Mod+Shift+-)
 *
 * Usage:
 * ```tsx
 * import { HorizontalRuleButton } from '@notesaner/editor-core';
 *
 * function FormattingToolbar({ editor }: { editor: Editor }) {
 *   return (
 *     <div>
 *       <HorizontalRuleButton editor={editor} />
 *       {// With a specific default style: }
 *       <HorizontalRuleButton editor={editor} defaultStyle="dashed" />
 *     </div>
 *   );
 * }
 * ```
 *
 * @see libs/editor-core/src/extensions/horizontal-rule.ts
 */

'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { HrStyle } from '../extensions/horizontal-rule';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HorizontalRuleButtonProps {
  /** The TipTap editor instance. */
  editor: Editor;
  /**
   * Default horizontal rule style to insert.
   * Defaults to the extension's configured defaultStyle (typically 'thin').
   */
  defaultStyle?: HrStyle;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon — horizontal line (divider)
// ---------------------------------------------------------------------------

function HorizontalRuleIcon({ className }: { className?: string }) {
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
      {/* Short lines above and below to indicate a block-level divider */}
      <line x1="2" y1="4" x2="14" y2="4" />
      {/* The horizontal rule itself — heavier stroke */}
      <line x1="1" y1="8" x2="15" y2="8" strokeWidth="2" />
      <line x1="2" y1="12" x2="14" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TOOLTIP = 'Insert horizontal rule (Mod+Shift+-)';

/**
 * Toolbar button that inserts a horizontal rule at the cursor position.
 */
export function HorizontalRuleButton({
  editor,
  defaultStyle,
  className,
}: HorizontalRuleButtonProps) {
  const isActive = editor.isActive('horizontalRule');

  const handleClick = useCallback(() => {
    editor.commands.insertHorizontalRule(defaultStyle ? { style: defaultStyle } : undefined);
  }, [editor, defaultStyle]);

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
      <HorizontalRuleIcon />
    </button>
  );
}

HorizontalRuleButton.displayName = 'HorizontalRuleButton';
