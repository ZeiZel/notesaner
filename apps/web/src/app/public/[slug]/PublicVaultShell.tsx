'use client';

/**
 * PublicVaultShell — client-side layout shell for public vault pages.
 *
 * Manages sidebar toggle state and wires together PublicNavigation and
 * PublicSidebar. This component exists because the layout.tsx must remain a
 * Server Component (for generateMetadata), but sidebar toggle state requires
 * client interactivity.
 *
 * Data flow:
 *   - Receives slug from the server layout.
 *   - Reads the current path from the browser URL (usePathname).
 *   - Passes a placeholder note tree to PublicSidebar — the real tree will
 *     come from an API call once the publish endpoints are wired up.
 */

import { useState, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PublicNavigation } from '@/features/publish/PublicNavigation';
import { PublicSidebar, type PublicNoteTreeNode } from '@/features/publish/PublicSidebar';

// ---- Types ----------------------------------------------------------------

interface PublicVaultShellProps {
  slug: string;
  children: ReactNode;
}

// ---- Placeholder note tree ------------------------------------------------

/**
 * Placeholder tree data. In production this will be fetched from the server
 * via the public vault notes API. The tree structure is ready to accept
 * real data without any component changes.
 */
const PLACEHOLDER_NOTES: PublicNoteTreeNode[] = [
  {
    title: 'Getting Started',
    path: 'getting-started',
    isFolder: true,
    children: [
      { title: 'Welcome', path: 'getting-started/welcome.md', isFolder: false },
      { title: 'Quick Start', path: 'getting-started/quick-start.md', isFolder: false },
    ],
  },
  {
    title: 'Guides',
    path: 'guides',
    isFolder: true,
    children: [
      { title: 'Markdown Basics', path: 'guides/markdown-basics.md', isFolder: false },
      { title: 'Linking Notes', path: 'guides/linking-notes.md', isFolder: false },
      { title: 'Publishing', path: 'guides/publishing.md', isFolder: false },
    ],
  },
  { title: 'README', path: 'README.md', isFolder: false },
  { title: 'Changelog', path: 'changelog.md', isFolder: false },
];

// ---- Path extraction helper -----------------------------------------------

/**
 * Extract the note path from the full URL pathname.
 * e.g. "/public/my-vault/guides/publishing" => "guides/publishing"
 */
function extractNotePath(pathname: string, slug: string): string | undefined {
  const prefix = `/public/${slug}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  return rest || undefined;
}

// ---- Component ------------------------------------------------------------

export function PublicVaultShell({ slug, children }: PublicVaultShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentPath = extractNotePath(pathname, slug);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Top navigation */}
      <PublicNavigation
        slug={slug}
        currentPath={currentPath}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Body: sidebar + content */}
      <div className="flex">
        {/* Sidebar */}
        <PublicSidebar
          slug={slug}
          notes={PLACEHOLDER_NOTES}
          currentPath={currentPath}
          isOpen={isSidebarOpen}
          onToggle={handleToggleSidebar}
        />

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
