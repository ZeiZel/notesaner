'use client';

/**
 * ThemeToggle — a compact 3-way toggle for the workspace toolbar.
 *
 * Cycles through: system -> dark -> light -> system
 * Displays the current mode with an icon.
 * No useEffect — derives display state from the store synchronously.
 */

import { useTheme } from './theme-provider';
import type { ThemePreference } from './themes';

interface ThemeToggleProps {
  /** Additional CSS classes to apply to the button */
  className?: string;
}

const CYCLE_ORDER: ThemePreference[] = ['system', 'dark', 'light'];

/**
 * Inline SVG icons to avoid an icon library dependency in this shared module.
 * Components that already import Lucide can create their own wrapper if preferred.
 */
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

function MonitorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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

const PREFERENCE_LABELS: Record<ThemePreference, string> = {
  dark: 'Dark mode',
  light: 'Light mode',
  system: 'System theme',
};

function PreferenceIcon({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') return <SunIcon />;
  if (preference === 'dark') return <MoonIcon />;
  return <MonitorIcon />;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  function handleClick() {
    const currentIndex = CYCLE_ORDER.indexOf(preference);
    const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
    setPreference(CYCLE_ORDER[nextIndex]);
  }

  const label = PREFERENCE_LABELS[preference] ?? `Theme: ${preference}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${label} — click to cycle theme`}
      title={label}
      className={[
        'inline-flex items-center justify-center',
        'h-8 w-8 rounded-md',
        'text-[color:var(--ns-color-foreground-secondary)]',
        'hover:bg-[color:var(--ns-color-background-hover)]',
        'hover:text-[color:var(--ns-color-foreground)]',
        'transition-colors duration-normal',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[color:var(--ns-color-ring)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <PreferenceIcon preference={preference} />
    </button>
  );
}
