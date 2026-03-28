'use client';

/**
 * SettingsDialog — full-screen settings modal with sidebar navigation.
 *
 * Opened by Cmd+, from the keyboard shortcut system or programmatically.
 *
 * Structure:
 *   - Left: narrow sidebar with nav items grouped by section
 *   - Right: scrollable content area rendering the active tab
 *
 * Admin-only tabs (Workspace, Members) are gated by an `isAdmin` prop.
 * In a production app this would come from the auth store.
 *
 * All state is local/Zustand — no useEffect needed.
 */

import { useState, Suspense, lazy } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@notesaner/ui';
import { PanelSpinner } from '@/shared/lib/skeletons';

// Lazy-load each settings tab — only the active tab's chunk is downloaded.
// Profile is imported eagerly since it's the default tab.
import { ProfileSettings } from './ProfileSettings';

const EditorSettings = lazy(() =>
  import('./EditorSettings').then((m) => ({ default: m.EditorSettings })),
);
const ThemeSettingsTab = lazy(() =>
  import('./ThemeSettingsTab').then((m) => ({ default: m.ThemeSettingsTab })),
);
const KeybindingSettings = lazy(() =>
  import('./KeybindingSettings').then((m) => ({ default: m.KeybindingSettings })),
);
const PluginSettings = lazy(() =>
  import('./PluginSettings').then((m) => ({ default: m.PluginSettings })),
);
const WorkspaceSettings = lazy(() =>
  import('./WorkspaceSettings').then((m) => ({ default: m.WorkspaceSettings })),
);
const MemberManagement = lazy(() =>
  import('./MemberManagement').then((m) => ({ default: m.MemberManagement })),
);

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

type SettingsTab =
  | 'profile'
  | 'editor'
  | 'theme'
  | 'keybindings'
  | 'plugins'
  | 'workspace'
  | 'members';

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'editor', label: 'Editor', icon: '✍️' },
  { id: 'theme', label: 'Appearance', icon: '🎨' },
  { id: 'keybindings', label: 'Keybindings', icon: '⌨️' },
  { id: 'plugins', label: 'Plugins', icon: '🔌' },
  { id: 'workspace', label: 'Workspace', icon: '🏢', adminOnly: true },
  { id: 'members', label: 'Members', icon: '👥', adminOnly: true },
];

const TAB_TITLES: Record<SettingsTab, string> = {
  profile: 'Profile',
  editor: 'Editor',
  theme: 'Appearance',
  keybindings: 'Keybindings',
  plugins: 'Plugins',
  workspace: 'Workspace',
  members: 'Members',
};

// ---------------------------------------------------------------------------
// SettingsDialog props
// ---------------------------------------------------------------------------

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** When true, workspace and members tabs are visible. Defaults to false. */
  isAdmin?: boolean;
  /** Initial tab to open. Defaults to 'profile'. */
  initialTab?: SettingsTab;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDialog({
  open,
  onClose,
  isAdmin = false,
  initialTab = 'profile',
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  function renderContent() {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'editor':
        return <EditorSettings />;
      case 'theme':
        return <ThemeSettingsTab />;
      case 'keybindings':
        return <KeybindingSettings />;
      case 'plugins':
        return <PluginSettings />;
      case 'workspace':
        return <WorkspaceSettings />;
      case 'members':
        return <MemberManagement />;
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[var(--ns-z-overlay)] bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200',
          )}
        />

        {/* Dialog panel */}
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-[var(--ns-z-modal)] flex',
            'sm:inset-[5%] sm:rounded-xl sm:overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200 shadow-floating',
          )}
          style={{ backgroundColor: 'var(--ns-color-background)' }}
          aria-label="Settings"
        >
          {/* Screen-reader only title */}
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Application settings. Use the sidebar to navigate between sections.
          </DialogPrimitive.Description>

          {/* Left sidebar */}
          <nav
            aria-label="Settings navigation"
            className="flex flex-col w-52 shrink-0 border-r overflow-y-auto py-4"
            style={{
              borderColor: 'var(--ns-color-border)',
              backgroundColor: 'var(--ns-color-background-surface)',
            }}
          >
            <div className="px-4 pb-3">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                Settings
              </p>
            </div>

            {/* Personal group */}
            <div className="px-2 mb-1">
              <p
                className="px-2 py-1 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                Personal
              </p>
            </div>

            {visibleItems
              .filter((i) => !i.adminOnly)
              .map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                />
              ))}

            {/* Admin group */}
            {isAdmin && (
              <>
                <div className="px-2 mt-4 mb-1">
                  <p
                    className="px-2 py-1 text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--ns-color-foreground-muted)' }}
                  >
                    Workspace
                  </p>
                </div>
                {visibleItems
                  .filter((i) => i.adminOnly)
                  .map((item) => (
                    <NavButton
                      key={item.id}
                      item={item}
                      isActive={activeTab === item.id}
                      onClick={() => setActiveTab(item.id)}
                    />
                  ))}
              </>
            )}

            {/* Close button at bottom */}
            <div className="mt-auto pt-4 px-2">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                  style={{ color: 'var(--ns-color-foreground-muted)' }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 shrink-0"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                  </svg>
                  Close
                </button>
              </DialogPrimitive.Close>
            </div>
          </nav>

          {/* Content area */}
          <div
            role="tabpanel"
            aria-label={TAB_TITLES[activeTab]}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-3xl px-8 py-6">
              {/* Section header */}
              <div className="mb-6">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: 'var(--ns-color-foreground)' }}
                >
                  {TAB_TITLES[activeTab]}
                </h2>
                <div className="mt-2 h-px" style={{ backgroundColor: 'var(--ns-color-border)' }} />
              </div>

              {/* Active section content (lazy-loaded tabs wrapped in Suspense) */}
              <Suspense fallback={<PanelSpinner />}>{renderContent()}</Suspense>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

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
        'mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-left',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <span className="text-base w-5 text-center" aria-hidden="true">
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}
