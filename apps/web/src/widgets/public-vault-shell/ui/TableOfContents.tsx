/**
 * TableOfContents — server-rendered table of contents for published notes.
 *
 * Renders heading links extracted from the markdown rendering pipeline.
 * This is a Server Component -- no client JS required.
 *
 * Features:
 *   - Hierarchical indentation based on heading level
 *   - Anchor links to heading IDs
 *   - Sticky positioning on large screens
 *   - Collapsible <details> on mobile
 *   - Accessible: semantic <nav> with aria-label
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TocEntry {
  /** The heading level (1-6). */
  level: number;
  /** The plain-text heading content. */
  text: string;
  /** The URL-safe slug used as the heading's id attribute. */
  slug: string;
}

interface TableOfContentsProps {
  /** The TOC entries extracted from the rendered note. */
  entries: TocEntry[];
}

// ---------------------------------------------------------------------------
// Internal list renderer
// ---------------------------------------------------------------------------

function TocList({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;

  // Normalize indentation relative to the minimum heading level
  const minLevel = Math.min(...entries.map((e) => e.level));

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar TOC
// ---------------------------------------------------------------------------

/**
 * Full table of contents displayed in the sidebar on large screens.
 * Hidden on screens smaller than 1140px.
 */
export function TableOfContents({ entries }: TableOfContentsProps) {
  if (entries.length < 3) return null;

  return (
    <aside className="published-note-sidebar">
      <nav aria-label="Table of contents" className="published-note-toc">
        <h2 className="published-note-toc-title">On this page</h2>
        <TocList entries={entries} />
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile TOC (collapsible)
// ---------------------------------------------------------------------------

/**
 * Collapsible table of contents for mobile/tablet screens.
 * Visible only below 1140px breakpoint (CSS-controlled via
 * published-note-toc-mobile class).
 */
export function MobileTableOfContents({ entries }: TableOfContentsProps) {
  if (entries.length < 3) return null;

  return (
    <details className="published-note-toc-mobile">
      <summary>Table of contents</summary>
      <nav aria-label="Table of contents" className="published-note-toc">
        <TocList entries={entries} />
      </nav>
    </details>
  );
}
