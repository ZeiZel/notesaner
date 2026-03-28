'use client';

/**
 * PublicNavigation — top navigation bar for public workspace view.
 *
 * Features:
 *   - Vault title with link to root
 *   - Sidebar toggle button (hamburger menu on mobile)
 *   - Back/forward browser navigation buttons
 *   - Breadcrumb integration
 *   - Search button that expands inline search bar
 *   - "Open in app" link
 *   - Responsive: collapses gracefully on small screens
 *
 * Usage:
 *   <PublicNavigation
 *     slug="my-vault"
 *     currentPath="projects/web/todo"
 *     onToggleSidebar={() => setIsOpen(prev => !prev)}
 *   />
 */

import { useState, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { PublicBreadcrumb } from './PublicBreadcrumb';

// ---- Types ----------------------------------------------------------------

interface PublicNavigationProps {
  /** The public vault slug. */
  slug: string;
  /** Current note path within the vault. */
  currentPath?: string;
  /** Toggle sidebar visibility (for mobile). */
  onToggleSidebar: () => void;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Icons ----------------------------------------------------------------

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.56 7.25h7.69a.75.75 0 0 1 0 1.5H4.56l3.22 3.22a.75.75 0 0 1 0 1.06Z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M8.22 3.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06l3.22-3.22H3.75a.75.75 0 0 1 0-1.5h7.69L8.22 4.53a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-3.04-3.04ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

// ---- Component ------------------------------------------------------------

export function PublicNavigation({
  slug,
  currentPath,
  onToggleSidebar,
  className,
}: PublicNavigationProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const handleForward = useCallback(() => {
    window.history.forward();
  }, []);

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    if (isSearchOpen) {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim().length < 2) return;
      // Navigate to a search results view (appending query param)
      window.location.href = `/public/${encodeURIComponent(slug)}?q=${encodeURIComponent(searchQuery.trim())}`;
    },
    [slug, searchQuery],
  );

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm',
        className,
      )}
    >
      <div className="mx-auto flex max-w-wide items-center gap-2 px-4 py-2">
        {/* Sidebar toggle (mobile) */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Toggle sidebar"
        >
          <MenuIcon />
        </button>

        {/* Back/Forward navigation */}
        <div className="hidden items-center gap-0.5 sm:flex">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-7 w-7 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <button
            type="button"
            onClick={handleForward}
            className="flex h-7 w-7 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Go forward"
          >
            <ForwardIcon />
          </button>
        </div>

        {/* Breadcrumb / search */}
        <div className="flex min-w-0 flex-1 items-center">
          {isSearchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-1 items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200"
              role="search"
              aria-label="Search published notes"
            >
              <SearchIcon />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search published notes..."
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={handleToggleSearch}
                className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close search"
              >
                <CloseIcon />
              </button>
            </form>
          ) : (
            <PublicBreadcrumb slug={slug} currentPath={currentPath} />
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Search toggle */}
          {!isSearchOpen && (
            <button
              type="button"
              onClick={handleToggleSearch}
              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Search published notes"
              title="Search (press /)"
            >
              <SearchIcon />
            </button>
          )}

          {/* Open in app */}
          <a
            href="/"
            className="hidden rounded-md px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-accent hover:text-primary sm:inline-flex"
          >
            Open in app
          </a>
        </div>
      </div>
    </header>
  );
}
