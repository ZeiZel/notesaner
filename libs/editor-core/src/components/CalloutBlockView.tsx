/**
 * CalloutBlockView — React NodeView component for callout block rendering.
 *
 * Renders callout blocks with:
 * - Themed icon and colour per callout type (info, warning, tip, danger, note)
 * - Editable title (inline editing on click)
 * - Collapsible body via header click
 * - Type selector dropdown for changing callout type
 * - Accessible: proper ARIA roles, keyboard navigation
 *
 * @see libs/editor-core/src/extensions/callout-block.ts
 */

'use client';

import { useState, useCallback, type CSSProperties } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { CalloutBlockAttrs, CalloutType } from '../extensions/callout-block';
import { CALLOUT_TYPES, CALLOUT_DEFAULT_TITLES } from '../extensions/callout-block';

// ---------------------------------------------------------------------------
// Colour and icon configuration per callout type
// ---------------------------------------------------------------------------

interface CalloutTheme {
  bg: string;
  border: string;
  headerBg: string;
  iconColor: string;
  textColor: string;
}

const CALLOUT_THEMES: Record<CalloutType, CalloutTheme> = {
  info: {
    bg: 'var(--ns-callout-info-bg, #eff6ff)',
    border: 'var(--ns-callout-info-border, #3b82f6)',
    headerBg: 'var(--ns-callout-info-header-bg, #dbeafe)',
    iconColor: 'var(--ns-callout-info-icon, #2563eb)',
    textColor: 'var(--ns-callout-info-text, #1e40af)',
  },
  warning: {
    bg: 'var(--ns-callout-warning-bg, #fffbeb)',
    border: 'var(--ns-callout-warning-border, #f59e0b)',
    headerBg: 'var(--ns-callout-warning-header-bg, #fef3c7)',
    iconColor: 'var(--ns-callout-warning-icon, #d97706)',
    textColor: 'var(--ns-callout-warning-text, #92400e)',
  },
  tip: {
    bg: 'var(--ns-callout-tip-bg, #ecfdf5)',
    border: 'var(--ns-callout-tip-border, #10b981)',
    headerBg: 'var(--ns-callout-tip-header-bg, #d1fae5)',
    iconColor: 'var(--ns-callout-tip-icon, #059669)',
    textColor: 'var(--ns-callout-tip-text, #065f46)',
  },
  danger: {
    bg: 'var(--ns-callout-danger-bg, #fef2f2)',
    border: 'var(--ns-callout-danger-border, #ef4444)',
    headerBg: 'var(--ns-callout-danger-header-bg, #fee2e2)',
    iconColor: 'var(--ns-callout-danger-icon, #dc2626)',
    textColor: 'var(--ns-callout-danger-text, #991b1b)',
  },
  note: {
    bg: 'var(--ns-callout-note-bg, #f5f3ff)',
    border: 'var(--ns-callout-note-border, #8b5cf6)',
    headerBg: 'var(--ns-callout-note-header-bg, #ede9fe)',
    iconColor: 'var(--ns-callout-note-icon, #7c3aed)',
    textColor: 'var(--ns-callout-note-text, #5b21b6)',
  },
};

// ---------------------------------------------------------------------------
// Callout icons (inline SVG — no external icon library dependency)
// ---------------------------------------------------------------------------

function CalloutIcon({ type }: { type: CalloutType }) {
  const size = 18;
  const props = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (type) {
    case 'info':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'tip':
      return (
        <svg {...props}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
      );
    case 'danger':
      return (
        <svg {...props}>
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'note':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Collapse chevron icon
// ---------------------------------------------------------------------------

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
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
      style={{
        transition: 'transform 0.15s ease',
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function getStyles(theme: CalloutTheme, collapsed: boolean) {
  return {
    wrapper: {
      borderLeft: `4px solid ${theme.border}`,
      borderRadius: '4px',
      backgroundColor: theme.bg,
      margin: '8px 0',
      overflow: 'hidden',
      outline: 'none',
    } satisfies CSSProperties,

    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: theme.headerBg,
      color: theme.textColor,
      cursor: 'pointer',
      userSelect: 'none' as const,
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.4,
      borderBottom: collapsed ? 'none' : `1px solid ${theme.border}33`,
    } satisfies CSSProperties,

    headerIcon: {
      display: 'flex',
      alignItems: 'center',
      color: theme.iconColor,
      flexShrink: 0,
    } satisfies CSSProperties,

    titleInput: {
      flex: 1,
      border: 'none',
      background: 'transparent',
      font: 'inherit',
      fontWeight: 600,
      color: 'inherit',
      outline: 'none',
      padding: 0,
      minWidth: 0,
    } satisfies CSSProperties,

    body: {
      padding: collapsed ? '0' : '8px 12px',
      maxHeight: collapsed ? '0' : 'none',
      overflow: collapsed ? 'hidden' : 'visible',
      transition: 'max-height 0.15s ease, padding 0.15s ease',
    } satisfies CSSProperties,

    typeSelector: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 6px',
      fontSize: '11px',
      fontWeight: 600,
      borderRadius: '3px',
      border: `1px solid ${theme.border}44`,
      background: 'transparent',
      color: theme.iconColor,
      cursor: 'pointer',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.03em',
      flexShrink: 0,
    } satisfies CSSProperties,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for callout blocks.
 */
export function CalloutBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as CalloutBlockAttrs;
  const theme = CALLOUT_THEMES[attrs.calloutType] ?? CALLOUT_THEMES.note;
  const styles = getStyles(theme, attrs.collapsed);
  const isEditable = editor.isEditable;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(attrs.title);

  // Sync title from external changes
  if (titleValue !== attrs.title && !isEditingTitle) {
    setTitleValue(attrs.title);
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleToggleCollapse = useCallback(() => {
    updateAttributes({ collapsed: !attrs.collapsed });
  }, [attrs.collapsed, updateAttributes]);

  const handleTitleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      setIsEditingTitle(true);
    },
    [isEditable],
  );

  const handleTitleBlur = useCallback(() => {
    const trimmed = titleValue.trim();
    const finalTitle = trimmed || CALLOUT_DEFAULT_TITLES[attrs.calloutType];
    updateAttributes({ title: finalTitle });
    setTitleValue(finalTitle);
    setIsEditingTitle(false);
  }, [titleValue, attrs.calloutType, updateAttributes]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleTitleBlur();
      }
    },
    [handleTitleBlur],
  );

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      const newType = e.target.value as CalloutType;
      updateAttributes({
        calloutType: newType,
        title:
          attrs.title === CALLOUT_DEFAULT_TITLES[attrs.calloutType]
            ? CALLOUT_DEFAULT_TITLES[newType]
            : attrs.title,
      });
    },
    [attrs.calloutType, attrs.title, updateAttributes],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="div"
      className={`ns-callout ns-callout--${attrs.calloutType}`}
      data-callout-block=""
      data-callout-type={attrs.calloutType}
      style={styles.wrapper}
    >
      {/* Header */}
      <div
        className="ns-callout__header"
        style={styles.header}
        onClick={handleToggleCollapse}
        role="button"
        tabIndex={0}
        aria-expanded={!attrs.collapsed}
        aria-label={`${attrs.calloutType} callout: ${attrs.title}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleCollapse();
          }
        }}
      >
        <ChevronIcon collapsed={attrs.collapsed} />

        <span style={styles.headerIcon}>
          <CalloutIcon type={attrs.calloutType} />
        </span>

        {/* Type selector (editable mode only) */}
        {isEditable && (
          <select
            value={attrs.calloutType}
            onChange={handleTypeChange}
            onClick={(e) => e.stopPropagation()}
            style={styles.typeSelector}
            aria-label="Callout type"
          >
            {CALLOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {/* Title */}
        {isEditingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={styles.titleInput}
            autoFocus
            aria-label="Callout title"
          />
        ) : (
          <span
            className="ns-callout__title"
            onClick={handleTitleClick}
            style={{
              flex: 1,
              cursor: isEditable ? 'text' : 'default',
            }}
          >
            {attrs.title}
          </span>
        )}
      </div>

      {/* Body (collapsible) */}
      <div className="ns-callout__body" style={styles.body}>
        <NodeViewContent className="ns-callout__content" />
      </div>
    </NodeViewWrapper>
  );
}

CalloutBlockView.displayName = 'CalloutBlockView';
