'use client';

/**
 * PublicThemeSettings.tsx
 *
 * Settings panel for customising the visual appearance of the public vault.
 *
 * Features:
 *   - Theme grid with preview cards for all 4 built-in themes
 *   - Font family selector (system-ui, serif, monospace, custom input)
 *   - Font size slider with live label
 *   - Max content width numeric input
 *   - Custom CSS textarea with sanitization warnings
 *   - Live preview toggle (enters isPreviewMode in the store)
 *   - Save / Reset buttons
 *
 * This component is self-contained: it reads from and writes to
 * usePublicThemeStore. The parent is responsible for persisting the settings
 * to the backend (e.g. calling workspace API) when onSave is triggered.
 */

import { useState, useCallback, useId, type ChangeEvent } from 'react';
import {
  PUBLIC_BUILT_IN_THEMES,
  PUBLIC_FONT_PRESETS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  MAX_WIDTH_MIN,
  MAX_WIDTH_MAX,
  detectBlockedCssPatterns,
  type PublicThemeId,
  type PublicFontFamily,
} from './public-themes';
import { usePublicThemeStore } from './public-theme-store';
import { PublicThemePreview } from './PublicThemePreview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PublicThemeSettingsProps {
  /**
   * Called when the user clicks Save with the current settings snapshot.
   * The parent should persist these to the backend.
   */
  onSave?: (settings: {
    selectedTheme: PublicThemeId;
    fontFamily: PublicFontFamily;
    customFontFamily: string;
    fontSize: number;
    maxWidth: number;
    customCss: string;
  }) => void;
  /**
   * Called when the user clicks Cancel / closes the panel.
   */
  onCancel?: () => void;
  /** Whether a save operation is in progress (disables the Save button). */
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicThemeSettings({
  onSave,
  onCancel,
  isSaving = false,
}: PublicThemeSettingsProps) {
  const fontSizeLabelId = useId();
  const maxWidthLabelId = useId();
  const customCssLabelId = useId();

  const {
    selectedTheme,
    fontFamily,
    customFontFamily,
    fontSize,
    maxWidth,
    customCss,
    isPreviewMode,
    setSelectedTheme,
    setFontFamily,
    setCustomFontFamily,
    setFontSize,
    setMaxWidth,
    setCustomCss,
    setPreviewMode,
    resetToDefaults,
  } = usePublicThemeStore();

  // Track CSS warnings to show the user inline hints without blocking save.
  const cssWarnings = detectBlockedCssPatterns(customCss);

  // Local state for max-width text input so we can validate before committing.
  const [maxWidthInput, setMaxWidthInput] = useState<string>(String(maxWidth));

  const handleMaxWidthChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setMaxWidthInput(raw);
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed)) {
        setMaxWidth(parsed);
      }
    },
    [setMaxWidth],
  );

  const handleMaxWidthBlur = useCallback(() => {
    // Snap displayed value to the clamped store value on blur.
    setMaxWidthInput(String(maxWidth));
  }, [maxWidth]);

  const handleSave = useCallback(() => {
    onSave?.({
      selectedTheme,
      fontFamily,
      customFontFamily,
      fontSize,
      maxWidth,
      customCss,
    });
  }, [onSave, selectedTheme, fontFamily, customFontFamily, fontSize, maxWidth, customCss]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    setMaxWidthInput(String(MAX_WIDTH_MAX));
  }, [resetToDefaults]);

  return (
    <div
      data-testid="public-theme-settings"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      {/* Section: Theme selection */}
      <section aria-labelledby="theme-section-heading">
        <h3
          id="theme-section-heading"
          style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}
        >
          Theme
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
          }}
          role="radiogroup"
          aria-label="Select public vault theme"
        >
          {PUBLIC_BUILT_IN_THEMES.map((theme) => (
            <PublicThemePreview
              key={theme.id}
              themeId={theme.id}
              fontFamily={fontFamily}
              customFontFamily={customFontFamily}
              fontSize={fontSize}
              showLabel
              isSelected={selectedTheme === theme.id}
              onClick={() => setSelectedTheme(theme.id)}
            />
          ))}
        </div>
      </section>

      {/* Section: Font family */}
      <section aria-labelledby="font-section-heading">
        <h3
          id="font-section-heading"
          style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}
        >
          Font Family
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          {PUBLIC_FONT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={fontFamily === preset.id}
              onClick={() => setFontFamily(preset.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: fontFamily === preset.id ? '2px solid currentColor' : '1px solid #aaa',
                fontWeight: fontFamily === preset.id ? 600 : 400,
                cursor: 'pointer',
                background: 'transparent',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom font input */}
        {fontFamily === 'custom' && (
          <div>
            <label
              htmlFor="custom-font-input"
              style={{ fontSize: '13px', marginBottom: '4px', display: 'block' }}
            >
              Custom font family (CSS value)
            </label>
            <input
              id="custom-font-input"
              type="text"
              value={customFontFamily}
              onChange={(e) => setCustomFontFamily(e.target.value)}
              placeholder='e.g. "Lora", Georgia, serif'
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #aaa',
              }}
            />
          </div>
        )}
      </section>

      {/* Section: Font size */}
      <section aria-labelledby={fontSizeLabelId}>
        <h3 id={fontSizeLabelId} style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>
          Base Font Size: {fontSize}px
        </h3>

        <input
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          aria-labelledby={fontSizeLabelId}
          style={{ width: '100%' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>{FONT_SIZE_MIN}px</span>
          <span>{FONT_SIZE_MAX}px</span>
        </div>
      </section>

      {/* Section: Max content width */}
      <section aria-labelledby={maxWidthLabelId}>
        <h3 id={maxWidthLabelId} style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>
          Max Content Width
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            min={MAX_WIDTH_MIN}
            max={MAX_WIDTH_MAX}
            value={maxWidthInput}
            onChange={handleMaxWidthChange}
            onBlur={handleMaxWidthBlur}
            aria-labelledby={maxWidthLabelId}
            style={{
              width: '90px',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid #aaa',
            }}
          />
          <span style={{ fontSize: '13px' }}>px</span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            ({MAX_WIDTH_MIN}–{MAX_WIDTH_MAX}px)
          </span>
        </div>
      </section>

      {/* Section: Custom CSS */}
      <section aria-labelledby={customCssLabelId}>
        <h3 id={customCssLabelId} style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
          Custom CSS
        </h3>

        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#888' }}>
          Override specific styles for your public vault. Use <code>--pub-*</code> CSS variables for
          consistent theming.
        </p>

        <textarea
          aria-labelledby={customCssLabelId}
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          placeholder={`/* Example */\n.pub-content h1 { letter-spacing: -0.02em; }`}
          rows={6}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: cssWarnings.length > 0 ? '1px solid #e03131' : '1px solid #aaa',
            fontFamily: 'monospace',
            fontSize: '13px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        {/* CSS sanitization warnings */}
        {cssWarnings.length > 0 && (
          <ul
            role="alert"
            aria-label="Custom CSS warnings"
            style={{
              margin: '6px 0 0',
              padding: '8px 8px 8px 24px',
              borderRadius: '4px',
              background: '#fff5f5',
              color: '#c92a2a',
              fontSize: '12px',
              listStyle: 'disc',
            }}
          >
            {cssWarnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid #e0e0e0',
        }}
      >
        {/* Left: preview toggle + reset */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setPreviewMode(!isPreviewMode)}
            aria-pressed={isPreviewMode}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #aaa',
              cursor: 'pointer',
              background: isPreviewMode ? '#e7f5ff' : 'transparent',
              fontWeight: isPreviewMode ? 600 : 400,
            }}
          >
            {isPreviewMode ? 'Previewing' : 'Preview'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #aaa',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Reset to defaults
          </button>
        </div>

        {/* Right: cancel + save */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #aaa',
                cursor: 'pointer',
                background: 'transparent',
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            aria-busy={isSaving}
            style={{
              padding: '6px 16px',
              borderRadius: '4px',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              background: '#1971c2',
              color: '#fff',
              fontWeight: 600,
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
