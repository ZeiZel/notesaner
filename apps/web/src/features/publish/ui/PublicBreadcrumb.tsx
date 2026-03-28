'use client';

/**
 * PublicBreadcrumb — breadcrumb navigation for public workspace view.
 *
 * Renders a clickable breadcrumb trail showing the current note's position
 * in the folder hierarchy. Each segment links to its parent folder or note.
 *
 * Features:
 *   - Auto-generated from the current URL path
 *   - Root segment links to the workspace index
 *   - Truncates long paths on small screens
 *   - Accessible: uses <nav> with aria-label and aria-current
 *   - Separator icons between segments
 *
 * Usage:
 *   <PublicBreadcrumb slug="my-vault" currentPath="projects/web/todo" />
 */

import { cn } from '@/shared/lib/utils';

// ---- Types ----------------------------------------------------------------

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface PublicBreadcrumbProps {
  /** The public vault slug. */
  slug: string;
  /**
   * The current note path within the vault (e.g. "projects/web/todo").
   * When undefined, we are at the vault root.
   */
  currentPath?: string;
  /** Additional CSS class name. */
  className?: string;
}

// ---- Helpers --------------------------------------------------------------

function buildSegments(slug: string, currentPath?: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [
    { label: slug, href: `/public/${encodeURIComponent(slug)}` },
  ];

  if (!currentPath) return segments;

  const parts = currentPath.split('/').filter(Boolean);
  let accumulatedPath = '';

  for (const part of parts) {
    accumulatedPath += `/${part}`;
    const displayName = decodeURIComponent(part).replace(/\.md$/, '');
    segments.push({
      label: displayName,
      href: `/public/${encodeURIComponent(slug)}${accumulatedPath}`,
    });
  }

  return segments;
}

// ---- Separator Icon -------------------------------------------------------

function ChevronSeparator() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0 text-foreground-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

// ---- Home Icon ------------------------------------------------------------

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354l-6-6Z" />
    </svg>
  );
}

// ---- Component ------------------------------------------------------------

export function PublicBreadcrumb({ slug, currentPath, className }: PublicBreadcrumbProps) {
  const segments = buildSegments(slug, currentPath);
  const lastIndex = segments.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const isLast = index === lastIndex;
          const isFirst = index === 0;

          return (
            <li key={segment.href} className="flex items-center gap-1">
              {index > 0 && <ChevronSeparator />}

              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-foreground max-w-[200px]"
                  title={segment.label}
                >
                  {segment.label}
                </span>
              ) : (
                <a
                  href={segment.href}
                  className={cn(
                    'inline-flex items-center gap-1 truncate rounded px-1 py-0.5 text-foreground-secondary transition-colors hover:text-primary hover:bg-accent max-w-[160px]',
                  )}
                  title={segment.label}
                >
                  {isFirst && <HomeIcon />}
                  <span className="truncate">{segment.label}</span>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
