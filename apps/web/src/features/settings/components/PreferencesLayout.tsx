'use client';

/**
 * PreferencesLayout — full settings page layout with sidebar navigation.
 *
 * Provides:
 *   - Left sidebar with tab navigation grouped by Personal / Workspace sections
 *   - Content area rendering the active settings panel
 *   - Responsive: sidebar collapses to top tabs on small screens
 *
 * Manages active tab as local state — no useEffect required.
 * Designed to be used both inside SettingsDialog and as a standalone page.
 */

import { useState, Suspense, lazy, type ReactNode } from 'react';
import { cn } from '@notesaner/ui';
import { PanelSpinner } from '@/shared/lib/skeletons';

// Eager-load default tab, lazy-load everything else
import { EditorPreferences } from './EditorPreferences';

const AppearancePreferences = lazy(() =>
  import('./AppearancePreferences').then((m) => ({ default: m.AppearancePreferences })),
);

// Re-use existing settings components via lazy imports
const ProfileSettings = lazy(() =>
  import('../ProfileSettings').then((m) => ({ default: m.ProfileSettings })),
);
const ThemeSettingsTab = lazy(() =>
  import('../ThemeSettingsTab').then((m) => ({ default: m.ThemeSettingsTab })),
);
const KeybindingSettings = lazy(() =>
  import('../KeybindingSettings').then((m) => ({ default: m.KeybindingSettings })),
);
const PluginSettings = lazy(() =>
  import('../PluginSettings').then((m) => ({ default: m.PluginSettings })),
);

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

export type PreferencesTab =
  | 'editor'
  | 'appearance'
  | 'profile'
  | 'theme'
  | 'keybindings'
  | 'plugins';

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavItem {
  id: PreferencesTab;
  label: string;
  icon: ReactNode;
}

// ---------------------------------------------------------------------------
// SVG icons (inline, consistent with project pattern)
// ---------------------------------------------------------------------------

function EditorIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12.854 0.854a.5.5 0 00-.708-.708l-10 10a.5.5 0 00-.128.196l-1.5 4.5a.5.5 0 00.632.632l4.5-1.5a.5.5 0 00.196-.128l10-10a.5.5 0 000-.708l-3-3zM2.832 13.169L1.536 12.63l.702-2.107L2.832 13.17zM11 2.5L13.5 5 12 6.5 9.5 4 11 2.5z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 0a8 8 0 000 16 2 2 0 002-2v-.09a1.65 1.65 0 011.66-1.66H12a4 4 0 004-4c0-4.42-3.58-8-8-8zm-3.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM8 8a4 4 0 00-4 4v.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V12a4 4 0 00-4-4z" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6 .278a.77.77 0 01.08.858 7.208 7.208 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.734.734 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M14 5a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V6a1 1 0 011-1h12zM2 4a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H2z" />
      <path d="M13 10.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm0-2a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-5 0A.25.25 0 018.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 018 8.75v-.5zm2 0a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm1 2a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-5-2A.25.25 0 016.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 016 8.75v-.5zm-2 0A.25.25 0 014.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 014 8.75v-.5zm-2 0A.25.25 0 012.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 012 8.75v-.5zm11-2a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-2 0a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-2 0A.25.25 0 019.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 019 6.75v-.5zm-2 0A.25.25 0 017.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 017 6.75v-.5zm-2 0A.25.25 0 015.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 015 6.75v-.5zm-3 0A.25.25 0 012.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 012 6.75v-.5zm0 4a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zM3.5 10.25a.25.25 0 01.25-.25h7.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-7.5a.25.25 0 01-.25-.25v-.5z" />
    </svg>
  );
}

function PluginIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M6 0a.5.5 0 01.5.5V3h3V.5a.5.5 0 011 0V3h1a2 2 0 012 2v1h2.5a.5.5 0 010 1H13.5v3h2.5a.5.5 0 010 1h-2.5v1a2 2 0 01-2 2h-1v2.5a.5.5 0 01-1 0V14h-3v2.5a.5.5 0 01-1 0V14H5a2 2 0 01-2-2v-1H.5a.5.5 0 010-1H3V7H.5a.5.5 0 010-1H3V5a2 2 0 012-2h1V.5A.5.5 0 016 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Editor',
    items: [
      { id: 'editor', label: 'Editor', icon: <EditorIcon /> },
      { id: 'keybindings', label: 'Keybindings', icon: <KeyboardIcon /> },
    ],
  },
  {
    title: 'Look & Feel',
    items: [
      { id: 'appearance', label: 'Appearance', icon: <PaletteIcon /> },
      { id: 'theme', label: 'Theme', icon: <ThemeIcon /> },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: <PersonIcon /> },
      { id: 'plugins', label: 'Plugins', icon: <PluginIcon /> },
    ],
  },
];

const TAB_TITLES: Record<PreferencesTab, string> = {
  editor: 'Editor Preferences',
  appearance: 'Appearance',
  profile: 'Profile',
  theme: 'Theme',
  keybindings: 'Keybindings',
  plugins: 'Plugins',
};

const TAB_DESCRIPTIONS: Record<PreferencesTab, string> = {
  editor: 'Configure fonts, link behaviour, autocomplete, and editor features.',
  appearance: 'Customize the interface density, accent color, and layout.',
  profile: 'Manage your display name, email, and avatar.',
  theme: 'Choose a theme, install community themes, and add custom CSS.',
  keybindings: 'View and customize keyboard shortcuts.',
  plugins: 'Manage installed plugins and install new ones.',
};

// ---------------------------------------------------------------------------
// NavButton
// ---------------------------------------------------------------------------

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left w-full',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <span
        className={cn(
          'shrink-0',
          isActive ? 'text-sidebar-accent-foreground' : 'text-foreground-muted',
        )}
      >
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PreferencesLayout props
// ---------------------------------------------------------------------------

export interface PreferencesLayoutProps {
  /** Initial tab to display. Defaults to 'editor'. */
  initialTab?: PreferencesTab;
  /** Optional header content rendered above the navigation. */
  header?: ReactNode;
  /** CSS class for the outer container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// PreferencesLayout
// ---------------------------------------------------------------------------

export function PreferencesLayout({
  initialTab = 'editor',
  header,
  className,
}: PreferencesLayoutProps) {
  const [activeTab, setActiveTab] = useState<PreferencesTab>(initialTab);

  function renderContent() {
    switch (activeTab) {
      case 'editor':
        return <EditorPreferences />;
      case 'appearance':
        return <AppearancePreferences />;
      case 'profile':
        return <ProfileSettings />;
      case 'theme':
        return <ThemeSettingsTab />;
      case 'keybindings':
        return <KeybindingSettings />;
      case 'plugins':
        return <PluginSettings />;
    }
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* ---- Sidebar ---- */}
      <nav
        aria-label="Preferences navigation"
        className="flex flex-col w-56 shrink-0 border-r overflow-y-auto py-4"
        style={{
          borderColor: 'var(--ns-color-border)',
          backgroundColor: 'var(--ns-color-background-surface)',
        }}
      >
        {header && <div className="px-4 pb-3">{header}</div>}

        {!header && (
          <div className="px-4 pb-3">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              Preferences
            </p>
          </div>
        )}

        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-1">
            <div className="px-2 mt-3 mb-1">
              <p
                className="px-2 py-1 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                {group.title}
              </p>
            </div>
            <div className="px-2 space-y-0.5">
              {group.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ---- Content area ---- */}
      <div role="tabpanel" aria-label={TAB_TITLES[activeTab]} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl px-8 py-6">
          {/* Section header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
              {TAB_TITLES[activeTab]}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ns-color-foreground-secondary)' }}>
              {TAB_DESCRIPTIONS[activeTab]}
            </p>
            <div className="mt-3 h-px" style={{ backgroundColor: 'var(--ns-color-border)' }} />
          </div>

          {/* Active tab content (lazy-loaded tabs wrapped in Suspense) */}
          <Suspense fallback={<PanelSpinner />}>{renderContent()}</Suspense>
        </div>
      </div>
    </div>
  );
}
