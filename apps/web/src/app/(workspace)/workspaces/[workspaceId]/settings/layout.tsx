'use client';

/**
 * Settings layout — sidebar tab navigation for workspace settings.
 *
 * Provides:
 *   - Left sidebar with tab links (General, Members, Plugins, etc.)
 *   - Breadcrumb navigation: Home > Settings > [Tab]
 *   - Admin RBAC guard (redirects non-admin users)
 *   - Content area for active tab (children from Next.js router)
 *
 * The layout fetches workspace settings once and shares via store.
 * Each tab page reads from the store -- no redundant fetches.
 */

import { type ReactNode, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@notesaner/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useWorkspaceSettingsStore } from '@/features/settings/workspace/workspace-settings-store';
import { PanelSpinner } from '@/shared/lib/skeletons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsTab = 'general' | 'members' | 'plugins' | 'appearance' | 'publish' | 'danger';

interface NavItem {
  id: SettingsTab;
  label: string;
  href: (workspaceId: string) => string;
  icon: ReactNode;
}

// ---------------------------------------------------------------------------
// SVG Icons (inline to avoid external dependency)
// ---------------------------------------------------------------------------

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.429 1.525a3.5 3.5 0 011.142 0 .75.75 0 01.624.53l.306 1.024a.25.25 0 00.348.154l.946-.49a.75.75 0 01.808.087 3.5 3.5 0 01.571.571.75.75 0 01.087.808l-.49.946a.25.25 0 00.154.348l1.024.306a.75.75 0 01.53.624 3.5 3.5 0 010 1.142.75.75 0 01-.53.624l-1.024.306a.25.25 0 00-.154.348l.49.946a.75.75 0 01-.087.808 3.5 3.5 0 01-.571.571.75.75 0 01-.808.087l-.946-.49a.25.25 0 00-.348.154l-.306 1.024a.75.75 0 01-.624.53 3.5 3.5 0 01-1.142 0 .75.75 0 01-.624-.53l-.306-1.024a.25.25 0 00-.348-.154l-.946.49a.75.75 0 01-.808-.087 3.5 3.5 0 01-.571-.571.75.75 0 01-.087-.808l.49-.946a.25.25 0 00-.154-.348L1.525 8.57a.75.75 0 01-.53-.624 3.5 3.5 0 010-1.142.75.75 0 01.53-.624l1.024-.306a.25.25 0 00.154-.348l-.49-.946a.75.75 0 01.087-.808 3.5 3.5 0 01.571-.571.75.75 0 01.808-.087l.946.49a.25.25 0 00.348-.154l.306-1.024a.75.75 0 01.624-.53zM8 10a2 2 0 100-4 2 2 0 000 4z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM8 8a4 4 0 00-4 4v.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V12a4 4 0 00-4-4z" />
      <path
        d="M12.5 5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12.5 6a3.5 3.5 0 013.5 3.5V11a.5.5 0 01-.5.5h-2.1a5.009 5.009 0 00-.9-2.1 4.4 4.4 0 00-.9-.9z"
        opacity=".6"
      />
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

function PaletteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 0a8 8 0 000 16 2 2 0 002-2v-.09a1.65 1.65 0 011.66-1.66H12a4 4 0 004-4c0-4.42-3.58-8-8-8zm-3.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 005.145 4H7.5V1.077zM4.09 4a9.27 9.27 0 01.64-1.539 6.7 6.7 0 01.597-.933A7.03 7.03 0 002.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 00-.656 2.5h2.49zM4.847 5a12.5 12.5 0 00-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.5 12.5 0 00-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 00.337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 01-.597-.933A9.268 9.268 0 014.09 12H2.255a7.024 7.024 0 003.072 2.472zM3.82 11a13.652 13.652 0 01-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0013.745 12H11.91a9.27 9.27 0 01-.64 1.539 6.688 6.688 0 01-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 01-.312 2.5zm.025-3.5H14.982a6.966 6.966 0 00-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.91 4a9.277 9.277 0 00-.64-1.539 6.692 6.692 0 00-.597-.933A7.024 7.024 0 0113.745 4H11.91zm-3.41-2.923c.67.204 1.335.82 1.887 1.855.173.324.33.682.468 1.068H8.5V1.077z" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.553.553 0 01-1.1 0L7.1 4.995z" />
      <path
        fillRule="evenodd"
        d="M6.232 2.192a2 2 0 013.536 0l5.404 9.631A2 2 0 0113.404 15H2.596a2 2 0 01-1.768-3.177l5.404-9.631zM7.58 3.01a.5.5 0 01.884 0l5.404 9.631A.5.5 0 0113.404 14H2.596a.5.5 0 01-.442-.764L7.58 3.01z"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6A.5.5 0 001.5 7.5v7a.5.5 0 00.5.5h4.5a.5.5 0 00.5-.5v-4h2v4a.5.5 0 00.5.5H14a.5.5 0 00.5-.5v-7a.5.5 0 00-.146-.354l-6-6zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 00-.5-.5h-3a.5.5 0 00-.5.5v4H2.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav configuration
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: 'General',
    href: (wsId) => `/workspaces/${wsId}/settings/general`,
    icon: <SettingsIcon />,
  },
  {
    id: 'members',
    label: 'Members',
    href: (wsId) => `/workspaces/${wsId}/settings/members`,
    icon: <UsersIcon />,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    href: (wsId) => `/workspaces/${wsId}/settings/plugins`,
    icon: <PluginIcon />,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    href: (wsId) => `/workspaces/${wsId}/settings/appearance`,
    icon: <PaletteIcon />,
  },
  {
    id: 'publish',
    label: 'Publish',
    href: (wsId) => `/workspaces/${wsId}/settings/publish`,
    icon: <GlobeIcon />,
  },
  {
    id: 'danger',
    label: 'Danger zone',
    href: (wsId) => `/workspaces/${wsId}/settings/danger`,
    icon: <AlertTriangleIcon />,
  },
];

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  members: 'Members',
  plugins: 'Plugins',
  appearance: 'Appearance',
  publish: 'Publish',
  danger: 'Danger zone',
};

// ---------------------------------------------------------------------------
// Derive active tab from pathname
// ---------------------------------------------------------------------------

function deriveActiveTab(pathname: string): SettingsTab {
  const segments = pathname.split('/');
  const tabSegment = segments[segments.indexOf('settings') + 1] as SettingsTab | undefined;
  if (tabSegment && tabSegment in TAB_LABELS) return tabSegment;
  return 'general';
}

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const pathname = usePathname();
  const router = useRouter();

  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const members = useWorkspaceStore((s) => s.members);

  const fetchSettings = useWorkspaceSettingsStore((s) => s.fetchSettings);
  const isLoading = useWorkspaceSettingsStore((s) => s.isLoading);
  const reset = useWorkspaceSettingsStore((s) => s.reset);

  const activeTab = deriveActiveTab(pathname);

  // ---- Check admin role ----
  const currentMember = members.find((m) => m.userId === user?.id);
  const isAdmin =
    currentMember?.role === 'owner' || currentMember?.role === 'admin' || user?.role === 'admin';

  // ---- Fetch settings on mount ----
  useEffect(() => {
    if (!accessToken || !workspaceId) return;

    void fetchSettings(accessToken, workspaceId);

    return () => {
      reset();
    };
  }, [accessToken, workspaceId, fetchSettings, reset]);

  // ---- RBAC guard: redirect non-admin users ----
  useEffect(() => {
    // Wait for members to load before checking
    if (members.length === 0) return;
    if (!isAdmin) {
      router.replace(`/workspaces/${workspaceId}`);
    }
  }, [isAdmin, members.length, router, workspaceId]);

  if (!isAdmin && members.length > 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-foreground-muted">
          You do not have permission to access workspace settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex h-11 items-center gap-1.5 border-b border-border px-6 text-xs"
      >
        <Link
          href={`/workspaces/${workspaceId}`}
          className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
        >
          <HomeIcon />
          <span>Home</span>
        </Link>
        <ChevronRightIcon />
        <Link
          href={`/workspaces/${workspaceId}/settings/general`}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          Settings
        </Link>
        <ChevronRightIcon />
        <span className="text-foreground font-medium">{TAB_LABELS[activeTab]}</span>
      </nav>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <nav
          aria-label="Settings navigation"
          className="flex w-56 shrink-0 flex-col border-r border-border bg-background-surface py-4 overflow-y-auto"
        >
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Workspace settings
            </p>
            {activeWorkspace && (
              <p className="mt-1 truncate text-xs text-foreground-secondary">
                {activeWorkspace.name}
              </p>
            )}
          </div>

          <div className="space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const isDanger = item.id === 'danger';

              return (
                <Link
                  key={item.id}
                  href={item.href(workspaceId)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? isDanger
                        ? 'bg-destructive/10 text-destructive font-medium'
                        : 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : isDanger
                        ? 'text-destructive/70 hover:bg-destructive/5 hover:text-destructive'
                        : 'text-foreground-secondary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0',
                      isDanger ? 'text-destructive/80' : 'text-foreground-muted',
                      isActive && !isDanger && 'text-sidebar-accent-foreground',
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Saving indicator */}
          <SaveIndicator />
        </nav>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <PanelSpinner />
          ) : (
            <div className="mx-auto max-w-3xl px-8 py-6">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save indicator — shows in sidebar footer when auto-saving
// ---------------------------------------------------------------------------

function SaveIndicator() {
  const isSaving = useWorkspaceSettingsStore((s) => s.isSaving);
  const error = useWorkspaceSettingsStore((s) => s.error);

  if (!isSaving && !error) return null;

  return (
    <div className="mt-auto px-4 pt-4">
      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
          Saving...
        </div>
      )}
      {error && !isSaving && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
