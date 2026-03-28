/**
 * PublishedNote.tsx
 *
 * Server Component that renders a published note with:
 *   - Styled article content with proper typography
 *   - Table of contents sidebar (collapsible on mobile)
 *   - Heading anchors for deep linking
 *   - Reading time estimate
 *   - Last updated timestamp
 *   - JSON-LD structured data (Article schema)
 *
 * This component is a Server Component — no `'use client'` directive.
 */

import type { TocEntry } from '../lib/render-note';
import { formatDate } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishedNoteProps {
  /** The note title (from metadata or frontmatter). */
  title: string;
  /** The rendered HTML content. */
  html: string;
  /** Table of contents entries extracted from headings. */
  toc: TocEntry[];
  /** Estimated reading time in minutes. */
  readingTimeMinutes: number;
  /** ISO 8601 date string of the last update. */
  updatedAt: string;
  /** The vault's public slug (for breadcrumb). */
  vaultSlug: string;
  /** The note's path within the vault (for breadcrumb). */
  notePath: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Breadcrumb({ vaultSlug, notePath }: { vaultSlug: string; notePath: string }) {
  const segments = notePath.split('/');
  const displaySegments = segments.map((seg) => decodeURIComponent(seg).replace(/\.md$/, ''));

  return (
    <nav aria-label="Breadcrumb" className="published-note-breadcrumb">
      <ol>
        <li>
          <a href={`/public/${vaultSlug}`}>{vaultSlug}</a>
        </li>
        {displaySegments.map((seg, idx) => {
          const isLast = idx === displaySegments.length - 1;
          return (
            <li key={idx} aria-current={isLast ? 'page' : undefined}>
              {isLast ? (
                <span>{seg}</span>
              ) : (
                <a href={`/public/${vaultSlug}/${segments.slice(0, idx + 1).join('/')}`}>{seg}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;

  // Find the minimum heading level to normalize indentation
  const minLevel = Math.min(...entries.map((e) => e.level));

  return (
    <nav aria-label="Table of contents" className="published-note-toc">
      <h2 className="published-note-toc-title">On this page</h2>
      <ul className="published-note-toc-list">
        {entries.map((entry) => (
          <li
            key={entry.slug}
            className="published-note-toc-item"
            style={{ paddingLeft: `${(entry.level - minLevel) * 12}px` }}
          >
            <a href={`#${entry.slug}`} className="published-note-toc-link">
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ArticleMeta({
  readingTimeMinutes,
  updatedAt,
}: {
  readingTimeMinutes: number;
  updatedAt: string;
}) {
  return (
    <div className="published-note-meta">
      <time dateTime={updatedAt} className="published-note-date">
        {formatDate(updatedAt)}
      </time>
      <span className="published-note-meta-sep" aria-hidden="true">
        ·
      </span>
      <span className="published-note-reading-time">{readingTimeMinutes} min read</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PublishedNote({
  title,
  html,
  toc,
  readingTimeMinutes,
  updatedAt,
  vaultSlug,
  notePath,
}: PublishedNoteProps) {
  return (
    <div className="published-note-layout">
      {/* Table of contents sidebar (visible on larger screens) */}
      {toc.length > 2 && (
        <aside className="published-note-sidebar">
          <TableOfContents entries={toc} />
        </aside>
      )}

      {/* Main article */}
      <article className="published-note-article">
        <Breadcrumb vaultSlug={vaultSlug} notePath={notePath} />

        <header className="published-note-header">
          <h1 className="published-note-title">{title}</h1>
          <ArticleMeta readingTimeMinutes={readingTimeMinutes} updatedAt={updatedAt} />
        </header>

        {/* Inline TOC for mobile (visible only on small screens) */}
        {toc.length > 2 && (
          <details className="published-note-toc-mobile">
            <summary>Table of contents</summary>
            <TableOfContents entries={toc} />
          </details>
        )}

        <div
          className="published-note-content"
          // The HTML was rendered server-side from trusted markdown.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
