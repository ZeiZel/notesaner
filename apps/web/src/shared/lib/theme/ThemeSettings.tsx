'use client';

/**
 * ThemeSettings — full-featured settings panel for theme management.
 *
 * Features:
 *   - Dark / Light / System radio selection
 *   - Visual preview cards for each available theme
 *   - Custom CSS snippet textarea with live preview
 *   - Community theme installer (paste a JSON URL)
 *   - Remove community themes
 *
 * Designed to be embedded inside a settings page without page reload.
 */

import { useActionState, useRef, useState } from 'react';
import { useTheme } from './theme-provider';
import { useThemeStore } from './theme-store';
import { BUILT_IN_THEMES, type Theme, type CommunityTheme } from './themes';

// ---------------------------------------------------------------------------
// Theme Preview Card
// ---------------------------------------------------------------------------

interface ThemePreviewProps {
  theme: Theme;
  isActive: boolean;
  onSelect: () => void;
}

function ThemePreviewCard({ theme, isActive, onSelect }: ThemePreviewProps) {
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
      {/* Mini workspace mockup */}
      <div
        style={{ backgroundColor: bg, width: 200, height: 130 }}
        className="flex text-left"
      >
        {/* Sidebar strip */}
        <div
          style={{
            backgroundColor: sidebar,
            width: 52,
            borderRight: `1px solid ${border}`,
            padding: '8px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {[40, 28, 36, 24].map((w, i) => (
            <div
              key={i}
              style={{
                height: 6,
                width: w,
                borderRadius: 3,
                backgroundColor: i === 0 ? primary : textMuted,
                opacity: i === 0 ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Title bar */}
          <div
            style={{
              height: 8,
              width: '60%',
              borderRadius: 4,
              backgroundColor: text,
              opacity: 0.9,
            }}
          />
          {/* Content lines */}
          {[100, 85, 92, 70].map((w, i) => (
            <div
              key={i}
              style={{
                height: 5,
                width: `${w}%`,
                borderRadius: 3,
                backgroundColor: textMuted,
                opacity: 0.5,
              }}
            />
          ))}
          {/* Accent block */}
          <div
            style={{
              height: 5,
              width: '40%',
              borderRadius: 3,
              backgroundColor: primary,
              opacity: 0.8,
              marginTop: 4,
            }}
          />
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
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
// Community theme installer action
// ---------------------------------------------------------------------------

interface InstallResult {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Main ThemeSettings component
// ---------------------------------------------------------------------------

export function ThemeSettings() {
  const { preference, resolvedTheme, setPreference, customCss, setCustomCss } =
    useTheme();
  const addCommunityTheme = useThemeStore((s) => s.addCommunityTheme);
  const removeCommunityTheme = useThemeStore((s) => s.removeCommunityTheme);
  const communityThemes = useThemeStore((s) => s.communityThemes);

  const [customCssValue, setCustomCssValue] = useState(customCss);
  const customCssApplyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce custom CSS application so we don't thrash the DOM on every keystroke
  function handleCustomCssChange(value: string) {
    setCustomCssValue(value);
    if (customCssApplyRef.current) clearTimeout(customCssApplyRef.current);
    customCssApplyRef.current = setTimeout(() => {
      setCustomCss(value);
    }, 400);
  }

  // useActionState for community theme installation — React 19 pattern
  const [installState, installAction, isInstalling] = useActionState<InstallResult, FormData>(
    async (_prev, formData) => {
      const url = (formData.get('themeUrl') as string | null)?.trim();
      if (!url) return { success: false, message: 'Please enter a URL.' };

      try {
        const res = await fetch(url);
        if (!res.ok) {
          return { success: false, message: `Failed to fetch: HTTP ${res.status}` };
        }
        const json: unknown = await res.json();

        // Basic shape validation
        if (
          typeof json !== 'object' ||
          json === null ||
          !('id' in json) ||
          !('name' in json) ||
          !('colors' in json)
        ) {
          return { success: false, message: 'Invalid theme format. Expected { id, name, colors, isDark }.' };
        }

        const theme = json as CommunityTheme;
        theme.sourceUrl = url;
        theme.downloadedAt = new Date().toISOString();

        // Ensure no collision with built-in IDs
        if (['dark', 'light', 'system'].includes(theme.id)) {
          return { success: false, message: `Theme id "${theme.id}" is reserved. Rename your theme.` };
        }

        addCommunityTheme(theme);
        return { success: true, message: `Theme "${theme.name}" installed successfully.` };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, message: `Error: ${message}` };
      }
    },
    { success: false, message: '' },
  );

  const builtInThemes = BUILT_IN_THEMES;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ------------------------------------------------------------------ */}
      {/* Section: Mode Selection */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          Appearance
        </h3>
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
          <p
            className="mt-2 text-xs"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Currently using {resolvedTheme} theme based on your system setting.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section: Built-in Themes */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          Built-in Themes
        </h3>
        <div className="flex flex-wrap gap-4">
          {builtInThemes.map((theme) => (
            <div key={theme.id}>
              <ThemePreviewCard
                theme={theme}
                isActive={preference === theme.id || (preference === 'system' && resolvedTheme === theme.id)}
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

      {/* ------------------------------------------------------------------ */}
      {/* Section: Community Themes */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          Community Themes
        </h3>

        {communityThemes.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-4">
            {communityThemes.map((theme) => (
              <div key={theme.id} className="relative">
                <ThemePreviewCard
                  theme={theme}
                  isActive={preference === theme.id}
                  onSelect={() => setPreference(theme.id)}
                />
                <p
                  className="mt-1.5 text-xs text-center"
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
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center"
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

        {/* Install form */}
        <form action={installAction} className="flex flex-col gap-2">
          <label
            htmlFor="themeUrl"
            className="text-xs"
            style={{ color: 'var(--ns-color-foreground-secondary)' }}
          >
            Install from URL (JSON theme file)
          </label>
          <div className="flex gap-2">
            <input
              id="themeUrl"
              name="themeUrl"
              type="url"
              placeholder="https://example.com/my-theme.json"
              disabled={isInstalling}
              className="flex-1 px-3 py-1.5 text-sm rounded-md"
              style={{
                backgroundColor: 'var(--ns-color-background-input)',
                border: '1px solid var(--ns-color-input)',
                color: 'var(--ns-color-foreground)',
              }}
            />
            <button
              type="submit"
              disabled={isInstalling}
              className="px-3 py-1.5 text-sm rounded-md disabled:opacity-50"
              style={{
                backgroundColor: 'var(--ns-color-primary)',
                color: 'var(--ns-color-primary-foreground)',
              }}
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          </div>
          {installState.message && (
            <p
              className="text-xs"
              style={{
                color: installState.success
                  ? 'var(--ns-color-success)'
                  : 'var(--ns-color-destructive)',
              }}
            >
              {installState.message}
            </p>
          )}
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section: Custom CSS */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          Custom CSS Snippet
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Injected after all theme variables. Changes apply without page reload.
          Override any <code style={{ color: 'var(--ns-color-primary)' }}>--ns-*</code> variable here.
        </p>
        <textarea
          value={customCssValue}
          onChange={(e) => handleCustomCssChange(e.target.value)}
          spellCheck={false}
          rows={8}
          placeholder={`/* Override theme tokens or add custom styles */\n:root {\n  --ns-font-sans: 'My Font', sans-serif;\n}`}
          className="w-full px-3 py-2 text-xs font-mono rounded-md resize-y"
          style={{
            backgroundColor: 'var(--ns-color-background-input)',
            border: '1px solid var(--ns-color-input)',
            color: 'var(--ns-color-foreground)',
            lineHeight: 1.6,
          }}
        />
        <p
          className="mt-1.5 text-xs"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Changes are auto-saved and applied live as you type (400 ms debounce).
        </p>
      </section>
    </div>
  );
}
