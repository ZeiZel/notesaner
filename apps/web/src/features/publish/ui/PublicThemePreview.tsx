'use client';

/**
 * PublicThemePreview.tsx
 *
 * Mini preview card that renders a representative sample of how the public
 * vault will look with the current theme settings.
 *
 * The preview is self-contained and inlines its own CSS variable bindings
 * so it can be rendered without the full PublicThemeProvider mounted (e.g.
 * when editing settings in a dialog while the workspace UI is still active).
 *
 * Props:
 *   themeId        — which theme to preview (defaults to store value)
 *   fontFamily     — font family preset to show
 *   customFontFamily — raw font family (used when fontFamily === 'custom')
 *   fontSize       — base font size for the preview (scaled down)
 *   maxWidth       — not applied to the preview (too wide for a card)
 *   showLabel      — whether to show the theme name below the card
 */

import { useMemo, type CSSProperties } from 'react';
import {
  findPublicThemeById,
  PUBLIC_BUILT_IN_THEMES,
  PUBLIC_FONT_PRESETS,
  type PublicThemeId,
  type PublicFontFamily,
} from '../model/public-themes';
import { usePublicThemeStore } from '../model/public-theme-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PublicThemePreviewProps {
  /** Theme to preview. Defaults to the store's selectedTheme. */
  themeId?: PublicThemeId;
  /** Font family preset. Defaults to the store's fontFamily. */
  fontFamily?: PublicFontFamily;
  /** Raw font family string when fontFamily === 'custom'. */
  customFontFamily?: string;
  /** Base font size (px). Defaults to the store's fontSize. */
  fontSize?: number;
  /** Show the theme name below the card. */
  showLabel?: boolean;
  /** Additional CSS class on the wrapper. */
  className?: string;
  /** Callback when the card is clicked — useful for theme selection grids. */
  onClick?: () => void;
  /** Whether this card is currently the selected/active theme. */
  isSelected?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicThemePreview({
  themeId: themeIdProp,
  fontFamily: fontFamilyProp,
  customFontFamily: customFontFamilyProp,
  fontSize: fontSizeProp,
  showLabel = true,
  className,
  onClick,
  isSelected = false,
}: PublicThemePreviewProps) {
  const storeTheme = usePublicThemeStore((s) => s.selectedTheme);
  const storeFontFamily = usePublicThemeStore((s) => s.fontFamily);
  const storeCustomFontFamily = usePublicThemeStore((s) => s.customFontFamily);
  const storeFontSize = usePublicThemeStore((s) => s.fontSize);

  const themeId = themeIdProp ?? storeTheme;
  const fontFamily = fontFamilyProp ?? storeFontFamily;
  const customFontFamily = customFontFamilyProp ?? storeCustomFontFamily;
  const fontSize = fontSizeProp ?? storeFontSize;

  const theme = findPublicThemeById(themeId);
  const resolvedTheme = theme ?? findPublicThemeById('light') ?? PUBLIC_BUILT_IN_THEMES[0];

  // Build an inline style object with the theme's CSS variables applied
  // directly, scaled to fit the small preview card.
  const inlineVars = useMemo<CSSProperties>(() => {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolvedTheme.colors)) {
      vars[`--${key}`] = value;
    }
    return vars as CSSProperties;
  }, [resolvedTheme]);

  const fontStack = useMemo<string>(() => {
    if (fontFamily === 'custom') {
      return customFontFamily
        ? `${customFontFamily}, system-ui, sans-serif`
        : 'system-ui, sans-serif';
    }
    const preset = PUBLIC_FONT_PRESETS.find((p) => p.id === fontFamily);
    return preset?.stack ?? 'system-ui, sans-serif';
  }, [fontFamily, customFontFamily]);

  // Scale the font size for the miniature preview (60% of actual size, min 10px).
  const previewFontSize = Math.max(10, Math.round(fontSize * 0.6));

  const containerStyle: CSSProperties = {
    ...inlineVars,
    backgroundColor: resolvedTheme.colors['pub-color-bg'],
    color: resolvedTheme.colors['pub-color-fg'],
    fontFamily: fontStack,
    fontSize: `${previewFontSize}px`,
    borderRadius: '6px',
    overflow: 'hidden',
    border: isSelected
      ? `2px solid ${resolvedTheme.colors['pub-color-accent']}`
      : `1px solid ${resolvedTheme.colors['pub-color-border']}`,
    cursor: onClick ? 'pointer' : 'default',
    width: '100%',
    userSelect: 'none',
  };

  const headerStyle: CSSProperties = {
    backgroundColor: resolvedTheme.colors['pub-color-bg-sidebar'],
    borderBottom: `1px solid ${resolvedTheme.colors['pub-color-border']}`,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const dotStyle = (color: string): CSSProperties => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  });

  const bodyStyle: CSSProperties = {
    padding: '8px 10px',
    lineHeight: 1.5,
  };

  const headingStyle: CSSProperties = {
    color: resolvedTheme.colors['pub-color-fg-heading'],
    fontWeight: 700,
    fontSize: `${previewFontSize + 2}px`,
    marginBottom: '4px',
  };

  const mutedStyle: CSSProperties = {
    color: resolvedTheme.colors['pub-color-fg-muted'],
    fontSize: `${previewFontSize - 1}px`,
    marginBottom: '4px',
  };

  const linkStyle: CSSProperties = {
    color: resolvedTheme.colors['pub-color-accent'],
    textDecoration: 'underline',
  };

  const codeStyle: CSSProperties = {
    backgroundColor: resolvedTheme.colors['pub-color-bg-code'],
    color: resolvedTheme.colors['pub-color-fg-code'],
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: `${previewFontSize - 1}px`,
    fontFamily: 'monospace',
  };

  return (
    <div
      className={className}
      style={{ display: 'inline-block', width: '100%' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-pressed={onClick ? isSelected : undefined}
      aria-label={onClick ? `Select ${resolvedTheme.name} theme` : undefined}
    >
      {/* Preview card */}
      <div style={containerStyle}>
        {/* Fake browser chrome bar */}
        <div style={headerStyle}>
          <div style={dotStyle('#ff5f56')} />
          <div style={dotStyle('#ffbd2e')} />
          <div style={dotStyle('#27c93f')} />
        </div>

        {/* Sample content body */}
        <div style={bodyStyle}>
          <div style={headingStyle}>Sample Heading</div>
          <div style={mutedStyle}>Published on March 28, 2026</div>
          <div style={{ marginBottom: '4px' }}>
            A paragraph of text with a <span style={linkStyle}>wiki link</span> and some{' '}
            <code style={codeStyle}>inline code</code>.
          </div>
          <div style={{ ...mutedStyle, marginBottom: 0 }}>Muted secondary content shown here.</div>
        </div>
      </div>

      {/* Optional label */}
      {showLabel && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '6px',
            fontSize: '11px',
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? resolvedTheme.colors['pub-color-accent'] : 'inherit',
          }}
        >
          {resolvedTheme.name}
        </div>
      )}
    </div>
  );
}
