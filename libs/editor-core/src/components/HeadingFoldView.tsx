/**
 * HeadingFoldView — React component for the heading fold toggle UI.
 *
 * This component provides a standalone React rendering of the fold toggle
 * button that can be used outside of the ProseMirror decoration system.
 * For example, in a table of contents sidebar or outline view.
 *
 * The primary fold toggle in the editor is rendered as a ProseMirror widget
 * decoration (see heading-fold.ts). This component is an alternative UI
 * entry point for external integrations.
 *
 * Props:
 *   - `isFolded`   — whether the heading is currently collapsed
 *   - `onToggle`   — callback when the user clicks the toggle
 *   - `level`      — heading level (1-6), used for styling/accessibility
 *   - `className`  — optional additional CSS class
 *   - `disabled`   — optional disabled state
 *
 * CSS classes:
 *   .ns-heading-fold-view                — outer container
 *   .ns-heading-fold-view__toggle        — the clickable button
 *   .ns-heading-fold-view__toggle--folded — when folded
 *
 * @see libs/editor-core/src/extensions/heading-fold.ts
 */

import React, { useCallback } from 'react';
import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeadingFoldViewProps {
  /** Whether the heading content is currently collapsed. */
  isFolded: boolean;

  /** Callback fired when the user clicks the fold toggle. */
  onToggle: () => void;

  /** Heading level (1-6). Used for aria-label. */
  level: number;

  /** Optional additional CSS class for the toggle button. */
  className?: string;

  /** Optional disabled state. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    padding: 0,
    margin: '0 4px 0 0',
    border: 'none',
    borderRadius: '3px',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--ns-text-muted, #64748b)',
    transition: 'background-color 0.15s, transform 0.15s, color 0.15s',
    flexShrink: 0,
    verticalAlign: 'middle',
    lineHeight: 1,
  } satisfies CSSProperties,

  toggleHover: {
    backgroundColor: 'var(--ns-fold-toggle-hover-bg, #f1f5f9)',
    color: 'var(--ns-text-primary, #1e293b)',
  } satisfies CSSProperties,

  icon: {
    transition: 'transform 0.15s ease',
  } satisfies CSSProperties,

  iconFolded: {
    transform: 'rotate(-90deg)',
  } satisfies CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronIcon({ folded }: { folded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={folded ? { ...styles.icon, ...styles.iconFolded } : styles.icon}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Standalone fold toggle button for headings.
 *
 * Use this in sidebar outlines, table of contents, or custom UIs that
 * need to control heading fold state externally.
 */
export function HeadingFoldView({
  isFolded,
  onToggle,
  level,
  className,
  disabled = false,
}: HeadingFoldViewProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        onToggle();
      }
    },
    [onToggle, disabled],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!disabled) {
          onToggle();
        }
      }
    },
    [onToggle, disabled],
  );

  const baseClass = 'ns-heading-fold-view__toggle';
  const composedClass = [baseClass, isFolded ? `${baseClass}--folded` : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={composedClass}
      aria-label={isFolded ? `Expand heading level ${level}` : `Collapse heading level ${level}`}
      aria-expanded={!isFolded}
      title={isFolded ? 'Expand section' : 'Collapse section'}
      disabled={disabled}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        ...styles.toggle,
        ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
      }}
    >
      <ChevronIcon folded={isFolded} />
    </button>
  );
}

HeadingFoldView.displayName = 'HeadingFoldView';
