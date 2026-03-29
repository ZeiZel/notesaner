/**
 * HorizontalRuleView — React NodeView component for horizontal rule rendering.
 *
 * Renders the horizontal rule with:
 * - Visual style based on the `style` attribute (thin | thick | dashed)
 * - Selected state highlight when the node is selected in the editor
 * - A style picker shown when the node is selected (editable mode only)
 * - CSS custom property-based theming for dark/light mode compatibility
 * - Accessible: role="separator", aria-orientation
 *
 * @see libs/editor-core/src/extensions/horizontal-rule.ts
 */

'use client';

import { useCallback, type CSSProperties } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { HR_STYLES, resolveHrStyle } from '../extensions/horizontal-rule';
import type { HrStyle, HorizontalRuleAttrs } from '../extensions/horizontal-rule';

// ---------------------------------------------------------------------------
// Style configuration
// ---------------------------------------------------------------------------

interface HrStyleConfig {
  /** CSS border-top shorthand for the rendered line. */
  borderTop: string;
  /** Human-readable label for the style picker. */
  label: string;
}

const HR_STYLE_CONFIGS: Record<HrStyle, HrStyleConfig> = {
  thin: {
    borderTop: '1px solid var(--ns-hr-color, var(--ns-color-border, #e2e8f0))',
    label: 'Thin',
  },
  thick: {
    borderTop: '3px solid var(--ns-hr-color, var(--ns-color-border, #cbd5e1))',
    label: 'Thick',
  },
  dashed: {
    borderTop: '2px dashed var(--ns-hr-color, var(--ns-color-border, #94a3b8))',
    label: 'Dashed',
  },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function getStyles(hrStyle: HrStyle, selected: boolean) {
  const config = HR_STYLE_CONFIGS[hrStyle] ?? HR_STYLE_CONFIGS.thin;

  return {
    wrapper: {
      position: 'relative',
      padding: '4px 0',
      cursor: 'default',
      userSelect: 'none',
    } satisfies CSSProperties,

    hr: {
      display: 'block',
      width: '100%',
      height: '0',
      border: 'none',
      borderTop: config.borderTop,
      margin: '0',
      outline: selected ? '2px solid var(--ns-color-primary, #3b82f6)' : '2px solid transparent',
      outlineOffset: '2px',
      borderRadius: '1px',
      transition: 'outline-color 0.1s ease',
    } satisfies CSSProperties,

    picker: {
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 6px',
      borderRadius: '6px',
      backgroundColor: 'var(--ns-color-popover, #ffffff)',
      border: '1px solid var(--ns-color-border, #e2e8f0)',
      boxShadow: 'var(--ns-shadow-md, 0 4px 12px rgba(0,0,0,0.08))',
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--ns-color-foreground-secondary, #64748b)',
      whiteSpace: 'nowrap',
    } satisfies CSSProperties,
  };
}

// ---------------------------------------------------------------------------
// Style picker button
// ---------------------------------------------------------------------------

interface StyleButtonProps {
  currentStyle: HrStyle;
  option: HrStyle;
  onClick: (style: HrStyle) => void;
}

function StyleButton({ currentStyle, option, onClick }: StyleButtonProps) {
  const config = HR_STYLE_CONFIGS[option];
  const isActive = currentStyle === option;

  return (
    <button
      type="button"
      title={config.label}
      aria-label={`Set horizontal rule style to ${config.label.toLowerCase()}`}
      aria-pressed={isActive}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(option);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '20px',
        padding: '2px 4px',
        borderRadius: '3px',
        border: isActive
          ? '1px solid var(--ns-color-primary, #3b82f6)'
          : '1px solid var(--ns-color-border, #e2e8f0)',
        background: isActive ? 'var(--ns-color-primary-muted, #eff6ff)' : 'transparent',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Mini preview of the style */}
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: '100%',
          height: '0',
          borderTop: config.borderTop,
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for horizontal rules.
 */
export function HorizontalRuleView({
  node,
  updateAttributes,
  selected,
  editor,
}: ReactNodeViewProps) {
  const attrs = node.attrs as HorizontalRuleAttrs;
  const hrStyle = resolveHrStyle(attrs.style);
  const styles = getStyles(hrStyle, selected);
  const isEditable = editor.isEditable;

  const handleStyleChange = useCallback(
    (newStyle: HrStyle) => {
      updateAttributes({ style: newStyle });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`ns-hr-wrapper ns-hr-wrapper--${hrStyle}`}
      data-horizontal-rule=""
      data-hr-style={hrStyle}
      style={styles.wrapper}
      contentEditable={false}
    >
      {/* The actual <hr> element */}
      <hr
        className={`ns-hr ns-hr--${hrStyle}`}
        style={styles.hr}
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Horizontal rule, ${hrStyle} style`}
      />

      {/* Style picker — shown only when selected in editable mode */}
      {selected && isEditable && (
        <div style={styles.picker} role="toolbar" aria-label="Horizontal rule style">
          <span style={{ marginRight: '2px' }}>Style:</span>
          {HR_STYLES.map((option) => (
            <StyleButton
              key={option}
              currentStyle={hrStyle}
              option={option}
              onClick={handleStyleChange}
            />
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}

HorizontalRuleView.displayName = 'HorizontalRuleView';
