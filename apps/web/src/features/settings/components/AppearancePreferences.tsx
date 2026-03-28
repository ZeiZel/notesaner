'use client';

/**
 * AppearancePreferences — personal appearance settings panel.
 *
 * This is the user-level appearance panel (distinct from workspace-level
 * AppearanceSettings in features/settings/workspace/).
 *
 * Controls:
 *   - UI density (compact / comfortable / spacious)
 *   - Custom accent color (hex picker with toggle)
 *   - Sidebar position (left / right)
 *   - Status bar visibility
 *   - Reduce animations
 *   - Content max-width
 *
 * All state lives in useSettingsStore.appearance (Zustand + localStorage).
 * No useEffect required — all interactions are synchronous event handlers.
 */

import { useSettingsStore, type UiDensity, type SidebarPosition } from '../settings-store';

// ---------------------------------------------------------------------------
// Toggle switch (consistent with EditorPreferences)
// ---------------------------------------------------------------------------

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="text-sm font-medium cursor-pointer"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors"
        style={{
          backgroundColor: checked ? 'var(--ns-color-primary)' : 'var(--ns-color-background)',
          border: `1px solid ${checked ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
          style={{
            backgroundColor: checked
              ? 'var(--ns-color-primary-foreground)'
              : 'var(--ns-color-foreground-muted)',
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section divider
// ---------------------------------------------------------------------------

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="pt-2">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        {title}
      </h3>
      <div className="h-px" style={{ backgroundColor: 'var(--ns-color-border)' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Density options
// ---------------------------------------------------------------------------

const DENSITY_OPTIONS: {
  value: UiDensity;
  label: string;
  description: string;
  paddingPreview: number;
}[] = [
  { value: 'compact', label: 'Compact', description: 'Tighter spacing', paddingPreview: 4 },
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'Default spacing',
    paddingPreview: 8,
  },
  { value: 'spacious', label: 'Spacious', description: 'More breathing room', paddingPreview: 12 },
];

// ---------------------------------------------------------------------------
// Sidebar position options
// ---------------------------------------------------------------------------

const SIDEBAR_OPTIONS: { value: SidebarPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

// ---------------------------------------------------------------------------
// Predefined accent colors
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Orange', value: '#f97316' },
];

// ---------------------------------------------------------------------------
// Layout preview
// ---------------------------------------------------------------------------

function LayoutPreview({
  sidebarPosition,
  density,
  contentMaxWidth,
}: {
  sidebarPosition: SidebarPosition;
  density: UiDensity;
  contentMaxWidth: number;
}) {
  const densityPx = density === 'compact' ? 2 : density === 'spacious' ? 6 : 4;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background-surface)',
        width: '100%',
        height: 100,
      }}
    >
      <div
        className="flex h-full"
        style={{ flexDirection: sidebarPosition === 'right' ? 'row-reverse' : 'row' }}
      >
        {/* Sidebar mock */}
        <div
          className="shrink-0"
          style={{
            width: 48,
            backgroundColor: 'var(--ns-color-background)',
            borderRight:
              sidebarPosition === 'left' ? '1px solid var(--ns-color-border)' : undefined,
            borderLeft:
              sidebarPosition === 'right' ? '1px solid var(--ns-color-border)' : undefined,
            padding: `${densityPx + 4}px ${densityPx}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: densityPx,
          }}
        >
          {[32, 24, 28, 20].map((w, i) => (
            <div
              key={i}
              style={{
                height: 4,
                width: Math.min(w, 40),
                borderRadius: 2,
                backgroundColor:
                  i === 0 ? 'var(--ns-color-primary)' : 'var(--ns-color-foreground-muted)',
                opacity: i === 0 ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Content area mock */}
        <div
          className="flex-1 flex justify-center"
          style={{ padding: `${densityPx + 4}px ${densityPx + 8}px` }}
        >
          <div
            style={{
              maxWidth: contentMaxWidth > 0 ? `${Math.round(contentMaxWidth / 5)}px` : '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: densityPx,
            }}
          >
            <div
              style={{
                height: 6,
                width: '50%',
                borderRadius: 3,
                backgroundColor: 'var(--ns-color-foreground)',
                opacity: 0.8,
              }}
            />
            {[90, 100, 75, 85].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 3,
                  width: `${w}%`,
                  borderRadius: 2,
                  backgroundColor: 'var(--ns-color-foreground-muted)',
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppearancePreferences
// ---------------------------------------------------------------------------

export function AppearancePreferences() {
  const appearance = useSettingsStore((s) => s.appearance);
  const updateAppearanceSettings = useSettingsStore((s) => s.updateAppearanceSettings);
  const resetAppearanceSettings = useSettingsStore((s) => s.resetAppearanceSettings);

  return (
    <div className="space-y-6 max-w-lg">
      {/* ---- Layout preview ---- */}
      <LayoutPreview
        sidebarPosition={appearance.sidebarPosition}
        density={appearance.uiDensity}
        contentMaxWidth={appearance.contentMaxWidth}
      />

      {/* ---- UI Density ---- */}
      <SectionDivider title="Interface density" />

      <div className="space-y-2">
        <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Controls spacing and padding throughout the interface.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateAppearanceSettings({ uiDensity: option.value })}
              aria-pressed={appearance.uiDensity === option.value}
              className="flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition-colors"
              style={{
                backgroundColor:
                  appearance.uiDensity === option.value
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-background-surface)',
                color:
                  appearance.uiDensity === option.value
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-secondary)',
                border: `1px solid ${
                  appearance.uiDensity === option.value
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-border)'
                }`,
              }}
            >
              {/* Visual density indicator */}
              <div
                className="flex flex-col gap-0.5 items-center"
                style={{ gap: `${option.paddingPreview}px` }}
              >
                {[16, 12, 14].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      height: 2,
                      width: w,
                      borderRadius: 1,
                      backgroundColor: 'currentColor',
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Accent color ---- */}
      <SectionDivider title="Accent color" />

      <ToggleSwitch
        id="pref-customAccent"
        label="Use custom accent color"
        description="Override the theme's accent color with a custom choice."
        checked={appearance.useCustomAccentColor}
        onChange={(useCustomAccentColor) => updateAppearanceSettings({ useCustomAccentColor })}
      />

      {appearance.useCustomAccentColor && (
        <div className="space-y-3">
          {/* Preset colors */}
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={`Select ${preset.label} accent color`}
                aria-pressed={appearance.accentColor === preset.value}
                onClick={() => updateAppearanceSettings({ accentColor: preset.value })}
                className="relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: preset.value,
                  outline:
                    appearance.accentColor === preset.value
                      ? `2px solid ${preset.value}`
                      : '1px solid var(--ns-color-border)',
                  outlineOffset: appearance.accentColor === preset.value ? '2px' : '0px',
                }}
              >
                {appearance.accentColor === preset.value && (
                  <svg
                    viewBox="0 0 16 16"
                    className="absolute inset-0 m-auto h-3.5 w-3.5"
                    fill="white"
                    aria-hidden="true"
                  >
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Custom color picker */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="pref-accentColor"
              className="text-sm"
              style={{ color: 'var(--ns-color-foreground-secondary)' }}
            >
              Custom
            </label>
            <input
              id="pref-accentColor"
              type="color"
              value={appearance.accentColor}
              onChange={(e) => updateAppearanceSettings({ accentColor: e.target.value })}
              className="h-8 w-12 rounded cursor-pointer border-0 p-0"
            />
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              {appearance.accentColor}
            </span>
          </div>
        </div>
      )}

      {/* ---- Layout ---- */}
      <SectionDivider title="Layout" />

      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
          Sidebar position
        </label>
        <div className="flex gap-2">
          {SIDEBAR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={appearance.sidebarPosition === option.value}
              onClick={() => updateAppearanceSettings({ sidebarPosition: option.value })}
              className="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  appearance.sidebarPosition === option.value
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-background-surface)',
                color:
                  appearance.sidebarPosition === option.value
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-secondary)',
                border: `1px solid ${
                  appearance.sidebarPosition === option.value
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-border)'
                }`,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="pref-contentMaxWidth"
            className="text-sm font-medium"
            style={{ color: 'var(--ns-color-foreground)' }}
          >
            Content max width
          </label>
          <span
            className="text-sm tabular-nums font-mono"
            style={{ color: 'var(--ns-color-foreground-secondary)' }}
          >
            {appearance.contentMaxWidth === 0 ? 'Full width' : `${appearance.contentMaxWidth}px`}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Limit the width of the content area. Set to 0 for full width.
        </p>
        <input
          id="pref-contentMaxWidth"
          type="range"
          min={0}
          max={1200}
          step={60}
          value={appearance.contentMaxWidth}
          onChange={(e) => {
            const val = Number(e.target.value);
            // Snap to 0 (full width) or clamped range
            updateAppearanceSettings({
              contentMaxWidth: val < 600 ? 0 : val,
            });
          }}
          className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
        />
        <div
          className="flex justify-between text-xs"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          <span>Full</span>
          <span>1200px</span>
        </div>
      </div>

      {/* ---- Miscellaneous ---- */}
      <SectionDivider title="Miscellaneous" />

      <ToggleSwitch
        id="pref-statusBar"
        label="Show status bar"
        description="Display word count and other info at the bottom of the editor."
        checked={appearance.showStatusBar}
        onChange={(showStatusBar) => updateAppearanceSettings({ showStatusBar })}
      />

      <ToggleSwitch
        id="pref-reduceAnimations"
        label="Reduce animations"
        description="Minimize motion throughout the interface. Respects system preference by default."
        checked={appearance.reduceAnimations}
        onChange={(reduceAnimations) => updateAppearanceSettings({ reduceAnimations })}
      />

      {/* ---- Reset ---- */}
      <div className="pt-4 border-t" style={{ borderColor: 'var(--ns-color-border)' }}>
        <button
          type="button"
          onClick={resetAppearanceSettings}
          className="text-sm transition-colors"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Reset all appearance settings to defaults
        </button>
      </div>
    </div>
  );
}
