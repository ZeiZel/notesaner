'use client';

/**
 * ThemeToggle — three-way theme selector using Ant Design Segmented.
 *
 * Renders a compact segmented control with sun / moon / monitor icons.
 * The selected segment reflects the current preference from the theme store.
 *
 * Variants:
 *   - compact (default): icon-only, suitable for the ribbon / toolbar
 *   - full: icon + label, suitable for the settings page inline controls
 *
 * State lives in the shared Zustand theme store so changes propagate to
 * ThemeProvider which applies the CSS class and Ant Design algorithm update.
 */

import { useMemo } from 'react';
import { Segmented, Tooltip } from 'antd';
import type { SegmentedProps } from 'antd';
import { useTheme } from '@/shared/lib/theme';
import type { ThemePreference } from '@/shared/lib/theme';

// ---------------------------------------------------------------------------
// Icons (inline SVG — avoids icon-library dependency inside this feature)
// ---------------------------------------------------------------------------

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

function MonitorIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Options configuration
// ---------------------------------------------------------------------------

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const THEME_TOOLTIPS: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'Follow system preference',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemeToggleProps {
  /**
   * 'compact' renders icon-only segments suitable for toolbars.
   * 'full' renders icon + text labels suitable for settings panels.
   * @default 'compact'
   */
  variant?: 'compact' | 'full';
  /** Ant Design Segmented size override. */
  size?: SegmentedProps['size'];
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Three-way theme toggle: light / dark / system.
 *
 * Reads preference from ThemeProvider context and writes via `setPreference`.
 * Custom/community theme selections (e.g. 'nord') are treated as unrecognised
 * by this component — the underlying store retains the full preference value,
 * but the Segmented shows no selection (uncontrolled passthrough).
 */
export function ThemeToggle({ variant = 'compact', size = 'small', className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  // Normalise: if the stored preference is a custom theme id that isn't one of
  // our three modes, show no selected segment rather than crashing.
  const activeMode: ThemeMode | undefined = THEME_MODES.includes(preference as ThemeMode)
    ? (preference as ThemeMode)
    : undefined;

  const options = useMemo<SegmentedProps['options']>(() => {
    if (variant === 'compact') {
      return THEME_MODES.map((mode) => ({
        value: mode,
        label: (
          <Tooltip title={THEME_TOOLTIPS[mode]} mouseEnterDelay={0.5}>
            <span
              aria-label={THEME_LABELS[mode]}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {mode === 'light' && <SunIcon />}
              {mode === 'dark' && <MoonIcon />}
              {mode === 'system' && <MonitorIcon />}
            </span>
          </Tooltip>
        ),
      }));
    }

    // full variant: icon + text
    return THEME_MODES.map((mode) => ({
      value: mode,
      label: (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          aria-label={THEME_LABELS[mode]}
        >
          {mode === 'light' && <SunIcon />}
          {mode === 'dark' && <MoonIcon />}
          {mode === 'system' && <MonitorIcon />}
          <span>{THEME_LABELS[mode]}</span>
        </span>
      ),
    }));
  }, [variant]);

  function handleChange(value: string | number) {
    const mode = String(value) as ThemePreference;
    setPreference(mode);
  }

  return (
    <Segmented
      value={activeMode}
      onChange={handleChange}
      options={options}
      size={size}
      className={className}
      aria-label="Select color theme"
    />
  );
}
