'use client';

/**
 * ThemeEditor — comprehensive theme customization UI.
 *
 * Features:
 *   - Light / Dark / System mode switcher
 *   - Built-in theme gallery with visual preview cards
 *   - Accent color picker (preset swatches + custom hex input)
 *   - UI font family selection
 *   - UI font size slider
 *   - Custom CSS textarea with live preview
 *   - Community theme installer
 *
 * Architecture:
 *   - Reads theme state from useTheme() context (shared/lib/theme)
 *   - Reads extended preferences from useThemePreferencesStore (shared/stores)
 *   - Applies overrides via theme-engine functions (imperative DOM manipulation)
 *   - No useEffect for derived state — all computations happen during render
 *   - useEffect is used ONLY for DOM side effects (applying CSS overrides)
 *
 * This component replaces the simpler ThemeSettingsTab when the full editor
 * is needed. It can be rendered inside SettingsDialog or standalone.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/shared/lib/theme/theme-provider';
import { useThemeStore } from '@/shared/lib/theme/theme-store';
import { BUILT_IN_THEMES, type Theme, type CommunityTheme } from '@/shared/lib/theme/themes';
import {
  ACCENT_COLOR_PRESETS,
  UI_FONT_PRESETS,
  applyAccentColorOverride,
  applyFontOverrides,
} from '@/shared/lib/theme/theme-engine';
import { useThemePreferencesStore } from '@/shared/stores/theme-store';
import { ThemePreview } from './ThemePreview';

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          {description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme Preview Card (mini workspace mockup)
// ---------------------------------------------------------------------------

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onSelect: () => void;
}

function ThemeCard({ theme, isActive, onSelect }: ThemeCardProps) {
  const bg = theme.colors['color-background'];
  const sidebar = theme.colors['color-sidebar-background'];
  const primary = theme.colors['color-primary'];
  const text = theme.colors['color-foreground'];
  const textMuted = theme.colors['color-foreground-muted'];
  const border = theme.colors['color-border'];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Select theme: ${theme.name}`}
      style={{
        outline: isActive ? `2px solid ${primary}` : `1px solid ${border}`,
        outlineOffset: '2px',
      }}
      className="relative rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] focus-visible:outline-none"
    >
      <div style={{ backgroundColor: bg, width: 180, height: 110 }} className="flex text-left">
        {/* Sidebar */}
        <div
          style={{
            backgroundColor: sidebar,
            width: 46,
            borderRight: `1px solid ${border}`,
            padding: '6px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {[36, 24, 30, 20].map((w, i) => (
            <div
              key={i}
              style={{
                height: 5,
                width: w,
                borderRadius: 3,
                backgroundColor: i === 0 ? primary : textMuted,
                opacity: i === 0 ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div
          style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}
        >
          <div
            style={{
              height: 7,
              width: '55%',
              borderRadius: 3,
              backgroundColor: text,
              opacity: 0.85,
            }}
          />
          {[90, 75, 82, 60].map((w, i) => (
            <div
              key={i}
              style={{
                height: 4,
                width: `${w}%`,
                borderRadius: 2,
                backgroundColor: textMuted,
                opacity: 0.45,
              }}
            />
          ))}
          <div
            style={{
              height: 4,
              width: '35%',
              borderRadius: 2,
              backgroundColor: primary,
              opacity: 0.75,
              marginTop: 2,
            }}
          />
        </div>
      </div>

      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Accent Color Picker
// ---------------------------------------------------------------------------

function AccentColorPicker() {
  const accentColor = useThemePreferencesStore((s) => s.accentColor);
  const setAccentColor = useThemePreferencesStore((s) => s.setAccentColor);
  const [customHex, setCustomHex] = useState(accentColor ?? '');

  const handlePresetClick = (hex: string) => {
    setAccentColor(hex);
    setCustomHex(hex);
  };

  const handleCustomChange = (value: string) => {
    setCustomHex(value);
    // Apply if it looks like a valid hex color
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setAccentColor(value);
    }
  };

  const handleReset = () => {
    setAccentColor(null);
    setCustomHex('');
  };

  return (
    <section>
      <SectionHeader
        title="Accent color"
        description="Override the primary color across the entire UI."
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {ACCENT_COLOR_PRESETS.map((preset) => {
          const isSelected = accentColor === preset.hex;
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => handlePresetClick(preset.hex)}
              aria-label={`${preset.label} accent color`}
              aria-pressed={isSelected}
              title={preset.label}
              className="relative w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: preset.hex,
                borderColor: isSelected ? 'var(--ns-color-foreground)' : 'transparent',
              }}
            >
              {isSelected && (
                <svg
                  className="absolute inset-0 m-auto"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6l2.5 2.5L9.5 4"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="custom-accent-hex"
          className="text-xs shrink-0"
          style={{ color: 'var(--ns-color-foreground-secondary)' }}
        >
          Custom:
        </label>
        <input
          id="custom-accent-hex"
          type="text"
          value={customHex}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="#cba6f7"
          maxLength={7}
          className="w-24 px-2 py-1 text-xs font-mono rounded-md"
          style={{
            backgroundColor: 'var(--ns-color-background-input)',
            border: '1px solid var(--ns-color-input)',
            color: 'var(--ns-color-foreground)',
          }}
        />
        <input
          type="color"
          value={accentColor ?? '#cba6f7'}
          onChange={(e) => {
            setCustomHex(e.target.value);
            setAccentColor(e.target.value);
          }}
          className="w-7 h-7 rounded cursor-pointer border-0 p-0"
          aria-label="Choose accent color"
          style={{ backgroundColor: 'transparent' }}
        />
        {accentColor && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs underline"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Font Family Picker
// ---------------------------------------------------------------------------

function FontFamilyPicker() {
  const uiFontPresetId = useThemePreferencesStore((s) => s.uiFontPresetId);
  const setUiFontFamily = useThemePreferencesStore((s) => s.setUiFontFamily);

  const handleChange = (presetId: string) => {
    const preset = UI_FONT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setUiFontFamily(presetId === 'system' ? null : preset.cssValue, presetId);
    }
  };

  return (
    <section>
      <SectionHeader
        title="UI font family"
        description="Change the font used throughout the application interface."
      />
      <select
        value={uiFontPresetId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full max-w-xs rounded-md px-3 py-2 text-sm"
        style={{
          backgroundColor: 'var(--ns-color-background-input)',
          border: '1px solid var(--ns-color-input)',
          color: 'var(--ns-color-foreground)',
        }}
        aria-label="UI font family"
      >
        {UI_FONT_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Font Size Slider
// ---------------------------------------------------------------------------

function FontSizeSlider() {
  const uiFontSize = useThemePreferencesStore((s) => s.uiFontSize);
  const setUiFontSize = useThemePreferencesStore((s) => s.setUiFontSize);

  const displaySize = uiFontSize ?? 16;

  return (
    <section>
      <SectionHeader
        title="UI font size"
        description="Adjust the base font size for all interface elements."
      />
      <div className="flex items-center gap-3 max-w-xs">
        <span
          className="text-xs font-mono w-8 text-right"
          style={{ color: 'var(--ns-color-foreground-secondary)' }}
        >
          {displaySize}px
        </span>
        <input
          type="range"
          min={12}
          max={22}
          step={1}
          value={displaySize}
          onChange={(e) => {
            const value = Number(e.target.value);
            setUiFontSize(value === 16 ? null : value);
          }}
          className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
          aria-label={`UI font size: ${displaySize}px`}
        />
        {uiFontSize !== null && (
          <button
            type="button"
            onClick={() => setUiFontSize(null)}
            className="text-xs"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Custom CSS Editor
// ---------------------------------------------------------------------------

function CustomCssEditor() {
  const { customCss, setCustomCss } = useTheme();
  const [localCss, setLocalCss] = useState(customCss);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      setLocalCss(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setCustomCss(value);
      }, 400);
    },
    [setCustomCss],
  );

  return (
    <section>
      <SectionHeader
        title="Custom CSS"
        description="Injected after all theme variables. Override any --ns-* variable or add custom styles."
      />
      <textarea
        value={localCss}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        rows={8}
        placeholder={`/* Override theme tokens */\n:root {\n  --ns-color-primary: #ff79c6;\n  --ns-font-sans: 'My Font', sans-serif;\n}`}
        className="w-full px-3 py-2 text-xs font-mono rounded-md resize-y"
        style={{
          backgroundColor: 'var(--ns-color-background-input)',
          border: '1px solid var(--ns-color-input)',
          color: 'var(--ns-color-foreground)',
          lineHeight: 1.6,
        }}
        aria-label="Custom CSS snippet"
      />
      <p className="mt-1.5 text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
        Changes are applied live with a 400ms debounce.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Community Theme Installer
// ---------------------------------------------------------------------------

function CommunityThemeSection() {
  const { preference, setPreference } = useTheme();
  const addCommunityTheme = useThemeStore((s) => s.addCommunityTheme);
  const removeCommunityTheme = useThemeStore((s) => s.removeCommunityTheme);
  const communityThemes = useThemeStore((s) => s.communityThemes);

  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<{ success: boolean; text: string } | null>(
    null,
  );

  async function handleInstall() {
    const url = installUrl.trim();
    if (!url) {
      setInstallMessage({ success: false, text: 'Please enter a URL.' });
      return;
    }

    setInstalling(true);
    setInstallMessage(null);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        setInstallMessage({ success: false, text: `Failed to fetch: HTTP ${res.status}` });
        return;
      }

      const json: unknown = await res.json();
      if (
        typeof json !== 'object' ||
        json === null ||
        !('id' in json) ||
        !('name' in json) ||
        !('colors' in json)
      ) {
        setInstallMessage({ success: false, text: 'Invalid theme format.' });
        return;
      }

      const theme = json as CommunityTheme;
      theme.sourceUrl = url;
      theme.downloadedAt = new Date().toISOString();

      if (['dark', 'light', 'system'].includes(theme.id)) {
        setInstallMessage({ success: false, text: `Theme id "${theme.id}" is reserved.` });
        return;
      }

      addCommunityTheme(theme);
      setInstallUrl('');
      setInstallMessage({ success: true, text: `Theme "${theme.name}" installed.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setInstallMessage({ success: false, text: `Error: ${message}` });
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section>
      <SectionHeader
        title="Community themes"
        description="Install themes from JSON URLs shared by the community."
      />

      {communityThemes.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {communityThemes.map((theme) => (
            <div key={theme.id} className="relative">
              <ThemeCard
                theme={theme}
                isActive={preference === theme.id}
                onSelect={() => setPreference(theme.id)}
              />
              <p
                className="mt-1 text-xs text-center"
                style={{ color: 'var(--ns-color-foreground-secondary)' }}
              >
                {theme.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (preference === theme.id) setPreference('dark');
                  removeCommunityTheme(theme.id);
                }}
                aria-label={`Remove theme: ${theme.name}`}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--ns-color-destructive)',
                  color: 'var(--ns-color-destructive-foreground)',
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="url"
          value={installUrl}
          onChange={(e) => setInstallUrl(e.target.value)}
          placeholder="https://example.com/my-theme.json"
          disabled={installing}
          className="flex-1 px-3 py-1.5 text-sm rounded-md"
          style={{
            backgroundColor: 'var(--ns-color-background-input)',
            border: '1px solid var(--ns-color-input)',
            color: 'var(--ns-color-foreground)',
          }}
          aria-label="Community theme JSON URL"
        />
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
          style={{
            backgroundColor: 'var(--ns-color-primary)',
            color: 'var(--ns-color-primary-foreground)',
          }}
        >
          {installing ? 'Installing...' : 'Install'}
        </button>
      </div>

      {installMessage && (
        <p
          className="mt-2 text-xs"
          style={{
            color: installMessage.success
              ? 'var(--ns-color-success)'
              : 'var(--ns-color-destructive)',
          }}
        >
          {installMessage.text}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main ThemeEditor component
// ---------------------------------------------------------------------------

export function ThemeEditor() {
  const { preference, resolvedTheme, activeTheme, setPreference } = useTheme();

  // Extended preferences
  const accentColor = useThemePreferencesStore((s) => s.accentColor);
  const uiFontFamily = useThemePreferencesStore((s) => s.uiFontFamily);
  const uiFontSize = useThemePreferencesStore((s) => s.uiFontSize);
  const resetPreferences = useThemePreferencesStore((s) => s.resetPreferences);

  // Apply accent color override to DOM when it changes.
  // Valid useEffect: imperative DOM mutation that cannot be done during render.
  useEffect(() => {
    applyAccentColorOverride(accentColor, activeTheme.isDark);
  }, [accentColor, activeTheme.isDark]);

  // Apply font overrides to DOM when they change.
  // Valid useEffect: imperative DOM mutation.
  useEffect(() => {
    applyFontOverrides({
      fontFamily: uiFontFamily,
      uiFontSize: uiFontSize,
    });
  }, [uiFontFamily, uiFontSize]);

  const hasOverrides = accentColor !== null || uiFontFamily !== null || uiFontSize !== null;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Live preview */}
      <section>
        <SectionHeader title="Preview" />
        <ThemePreview />
      </section>

      {/* Mode selection */}
      <section>
        <SectionHeader
          title="Appearance mode"
          description="Choose between dark, light, or follow your system setting."
        />
        <div className="flex gap-2">
          {(['system', 'dark', 'light'] as const).map((mode) => {
            const isSelected = preference === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setPreference(mode)}
                aria-pressed={isSelected}
                className="px-4 py-2 rounded-md text-sm capitalize transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-background-surface)',
                  color: isSelected
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-secondary)',
                  border: `1px solid ${isSelected ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
        {preference === 'system' && (
          <p className="mt-2 text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            Currently using {resolvedTheme} theme based on your system setting.
          </p>
        )}
      </section>

      {/* Built-in themes */}
      <section>
        <SectionHeader title="Built-in themes" />
        <div className="flex flex-wrap gap-4">
          {BUILT_IN_THEMES.map((theme) => (
            <div key={theme.id}>
              <ThemeCard
                theme={theme}
                isActive={
                  preference === theme.id || (preference === 'system' && resolvedTheme === theme.id)
                }
                onSelect={() => setPreference(theme.id)}
              />
              <p
                className="mt-1.5 text-xs text-center"
                style={{ color: 'var(--ns-color-foreground-secondary)' }}
              >
                {theme.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Accent color */}
      <AccentColorPicker />

      {/* Font family */}
      <FontFamilyPicker />

      {/* Font size */}
      <FontSizeSlider />

      {/* Custom CSS */}
      <CustomCssEditor />

      {/* Community themes */}
      <CommunityThemeSection />

      {/* Reset all overrides */}
      {hasOverrides && (
        <section>
          <button
            type="button"
            onClick={resetPreferences}
            className="text-sm underline"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Reset all customizations to defaults
          </button>
        </section>
      )}
    </div>
  );
}
