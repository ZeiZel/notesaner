'use client';

type MobileNavTab = 'files' | 'editor' | 'search' | 'outline' | 'more';

interface MobileBottomNavProps {
  /** Currently active tab */
  activeTab: MobileNavTab;
  /** Callback when a tab is selected */
  onTabChange: (tab: MobileNavTab) => void;
}

const NAV_ITEMS: {
  id: MobileNavTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: 'files',
    label: 'Files',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    ),
  },
  {
    id: 'outline',
    label: 'Outline',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'More',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
        />
      </svg>
    ),
  },
];

/**
 * MobileBottomNav -- bottom tab bar for mobile viewport.
 *
 * Provides quick navigation between workspace panels on small screens
 * where the desktop sidebar layout is hidden. Uses 44px minimum touch
 * targets per WCAG 2.5.5 (Target Size).
 *
 * Safe area insets are handled via `pb-[env(safe-area-inset-bottom)]` to
 * account for devices with home indicator bars (iPhone, etc.).
 */
export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      role="tablist"
      className="fixed inset-x-0 bottom-0 z-50 flex items-end border-t border-border bg-background-surface"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex w-full items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-label={item.label}
              aria-selected={isActive}
              onClick={() => onTabChange(item.id)}
              className={[
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5',
                'touch-target transition-colors',
                isActive ? 'text-primary' : 'text-foreground-muted hover:text-foreground-secondary',
              ].join(' ')}
            >
              {item.icon(isActive)}
              <span className="text-[10px] leading-tight font-medium" aria-hidden="true">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export type { MobileNavTab };
