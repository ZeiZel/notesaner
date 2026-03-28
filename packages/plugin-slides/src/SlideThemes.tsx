/**
 * SlideThemes — theme picker UI component for the slides plugin.
 *
 * Renders a horizontal strip of theme preview swatches. Clicking a swatch
 * calls `onSelect` with the theme id. The currently selected theme is
 * highlighted with a ring.
 */

import React from 'react';
import { BUILT_IN_THEMES } from './slide-themes';
import type { SlideTheme } from './slide-themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideThemesProps {
  /** Currently selected theme id. */
  selectedThemeId: string;
  /** Called when the user picks a different theme. */
  onSelect: (themeId: string) => void;
  /** Optional additional CSS class applied to the container. */
  className?: string;
  /**
   * Layout orientation.
   * - "horizontal" (default) — swatches in a scrollable row
   * - "vertical"             — stacked list with labels
   */
  layout?: 'horizontal' | 'vertical';
}

// ---------------------------------------------------------------------------
// Individual theme swatch
// ---------------------------------------------------------------------------

interface ThemeSwatchProps {
  theme: SlideTheme;
  isSelected: boolean;
  onSelect: (id: string) => void;
  showLabel: boolean;
}

function ThemeSwatch({
  theme,
  isSelected,
  onSelect,
  showLabel,
}: ThemeSwatchProps): React.ReactElement {
  return (
    <button
      type="button"
      title={`${theme.label}: ${theme.description}`}
      aria-pressed={isSelected}
      aria-label={`${theme.label} theme`}
      onClick={() => onSelect(theme.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem',
        borderRadius: '0.5rem',
        border: isSelected ? `2px solid ${theme.vars['--slide-accent']}` : '2px solid transparent',
        background: 'transparent',
        cursor: 'pointer',
        outline: 'none',
        transition: 'border-color 0.15s',
        flexShrink: 0,
      }}
    >
      {/* Mini preview card */}
      <div
        aria-hidden="true"
        style={{
          width: showLabel ? '4.5rem' : '3.5rem',
          height: showLabel ? '2.75rem' : '2.25rem',
          borderRadius: '0.3rem',
          background: theme.vars['--slide-bg'],
          border: `1px solid ${theme.vars['--slide-indicator']}`,
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Heading mock line */}
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: '10%',
            right: '10%',
            height: '14%',
            borderRadius: '2px',
            background: theme.vars['--slide-heading'],
            opacity: 0.85,
          }}
        />
        {/* Body mock lines */}
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: '10%',
            right: '30%',
            height: '9%',
            borderRadius: '2px',
            background: theme.vars['--slide-text'],
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '57%',
            left: '10%',
            right: '20%',
            height: '9%',
            borderRadius: '2px',
            background: theme.vars['--slide-text'],
            opacity: 0.3,
          }}
        />
        {/* Accent dot */}
        <div
          style={{
            position: 'absolute',
            bottom: '14%',
            right: '10%',
            width: '14%',
            height: '14%',
            borderRadius: '50%',
            background: theme.vars['--slide-accent'],
          }}
        />
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? '#1e293b' : '#64748b',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {theme.label}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders the theme picker. Consumes no store state directly — the parent is
 * responsible for passing `selectedThemeId` and handling `onSelect`.
 */
export function SlideThemes({
  selectedThemeId,
  onSelect,
  className,
  layout = 'horizontal',
}: SlideThemesProps): React.ReactElement {
  const isHorizontal = layout === 'horizontal';

  return (
    <div
      className={className}
      role="listbox"
      aria-label="Presentation theme"
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: isHorizontal ? '0.25rem' : '0.5rem',
        padding: '0.25rem',
        overflowX: isHorizontal ? 'auto' : undefined,
        flexWrap: isHorizontal ? 'nowrap' : undefined,
        alignItems: isHorizontal ? 'center' : undefined,
      }}
    >
      {BUILT_IN_THEMES.map((theme) => (
        <ThemeSwatch
          key={theme.id}
          theme={theme}
          isSelected={theme.id === selectedThemeId}
          onSelect={onSelect}
          showLabel={!isHorizontal}
        />
      ))}
    </div>
  );
}
