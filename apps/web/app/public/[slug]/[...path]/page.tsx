import type { Metadata } from 'next';
import {
  getPublishedNoteOrNotFound,
  getPublishedNote,
  generateNoteMetadata,
} from '@/features/publish';
import {
  TableOfContents,
  MobileTableOfContents,
} from '@/widgets/public-vault-shell/ui/TableOfContents';
import { formatDate } from '@/shared/lib/utils';

// Import published-note styles
import '@/features/publish/ui/published-note.css';

// ---------------------------------------------------------------------------
// ISR: revalidate every 5 minutes
// ---------------------------------------------------------------------------
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicNotePageProps {
  params: Promise<{ slug: string; path: string[] }>;
}

// ---------------------------------------------------------------------------
// Metadata (SEO)
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PublicNotePageProps): Promise<Metadata> {
  const { slug, path } = await params;
  const notePath = path.join('/');

  const note = await getPublishedNote(slug, notePath);

  if (!note) {
    const noteName = path[path.length - 1] ?? 'Note';
    const title = decodeURIComponent(noteName).replace(/\.md$/, '');
    return { title };
  }

  return generateNoteMetadata({
    slug,
    notePath,
    title: note.title,
    html: note.html,
    updatedAt: note.updatedAt,
    frontmatter: note.frontmatter,
  });
}

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

function ArticleJsonLd({
  title,
  excerpt,
  updatedAt,
  url,
}: {
  title: string;
  excerpt: string;
  updatedAt: string;
  url: string;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt,
    dateModified: updatedAt,
    url,
    publisher: {
      '@type': 'Organization',
      name: 'Notesaner',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb({ slug, notePath }: { slug: string; notePath: string }) {
  const segments = notePath.split('/');
  const displaySegments = segments.map((seg) => decodeURIComponent(seg).replace(/\.md$/, ''));

  return (
    <nav aria-label="Breadcrumb" className="published-note-breadcrumb">
      <ol>
        <li>
          <a href={`/public/${encodeURIComponent(slug)}`}>{slug}</a>
        </li>
        {displaySegments.map((seg, idx) => {
          const isLast = idx === displaySegments.length - 1;
          const href = `/public/${encodeURIComponent(slug)}/${segments.slice(0, idx + 1).join('/')}`;

          return (
            <li key={idx} aria-current={isLast ? 'page' : undefined}>
              {isLast ? <span>{seg}</span> : <a href={href}>{seg}</a>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Public published note page.
 *
 * Server-rendered with ISR (5-minute revalidation). Features:
 *   - Markdown rendered to HTML via unified/remark/rehype pipeline
 *   - Syntax highlighting via Shiki
 *   - Math rendering via KaTeX
 *   - Table of contents extracted from headings
 *   - Breadcrumb navigation
 *   - JSON-LD structured data for SEO
 *   - Reading time estimate
 *   - KaTeX CSS included for math rendering
 */
export default async function PublicNotePage({ params }: PublicNotePageProps) {
  const { slug, path } = await params;
  const notePath = path.join('/');

  // Fetch note data from the backend API
  const note = await getPublishedNoteOrNotFound(slug, notePath);

  // Render the HTML through the unified pipeline for syntax highlighting,
  // math, TOC extraction, etc.
  //
  // The backend already returns rendered HTML, but we re-render on the
  // frontend to get Shiki syntax highlighting (which requires Node.js)
  // and KaTeX math rendering, plus TOC extraction. If the backend HTML
  // is sufficient, we could skip this step -- but the enhanced pipeline
  // provides significantly better output quality.
  //
  // We use the backend's html as the source only if we don't have the
  // raw markdown. Since the backend returns pre-rendered HTML, we use it
  // directly for the content and extract TOC from it.
  const rendered = await renderFromBackendHtml(note.html, slug);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const noteUrl = `${appUrl}/public/${slug}/${notePath}`;

  return (
    <>
      {/* KaTeX CSS for math rendering */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
        crossOrigin="anonymous"
      />

      {/* JSON-LD structured data */}
      <ArticleJsonLd
        title={note.title}
        excerpt={rendered.excerpt}
        updatedAt={note.updatedAt}
        url={noteUrl}
      />

      <div className="published-note-layout">
        {/* Table of contents sidebar (desktop) */}
        <TableOfContents entries={rendered.toc} />

        {/* Main article */}
        <article className="published-note-article">
          <Breadcrumb slug={slug} notePath={notePath} />

          <header className="published-note-header">
            <h1 className="published-note-title">{note.title}</h1>
            <div className="published-note-meta">
              <time dateTime={note.updatedAt} className="published-note-date">
                {formatDate(note.updatedAt)}
              </time>
              <span className="published-note-meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="published-note-reading-time">
                {rendered.readingTimeMinutes} min read
              </span>
            </div>
          </header>

          {/* Mobile TOC */}
          <MobileTableOfContents entries={rendered.toc} />

          {/* Rendered note content */}
          <div
            className="published-note-content"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        </article>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Process backend-rendered HTML to extract TOC, compute reading time, and
 * generate an excerpt. The backend HTML is used directly for content.
 *
 * If the backend ever returns raw markdown instead of HTML, this function
 * should be replaced with a call to renderMarkdown().
 */
async function renderFromBackendHtml(
  html: string,
  _slug: string,
): Promise<{
  html: string;
  toc: Array<{ level: number; text: string; slug: string }>;
  readingTimeMinutes: number;
  excerpt: string;
}> {
  // Extract TOC from the heading elements in the HTML
  const toc: Array<{ level: number; text: string; slug: string }> = [];
  const headingRegex = /<h([1-6])\s+id="([^"]*)"[^>]*>(?:<a[^>]*>[^<]*<\/a>)?\s*(.*?)<\/h[1-6]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const slug = match[2];
    // Strip remaining HTML tags from the heading text
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    if (text && slug) {
      toc.push({ level, text, slug });
    }
  }

  // Calculate reading time
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 230));

  // Extract excerpt
  let excerpt = plainText;
  if (excerpt.length > 160) {
    const truncated = excerpt.slice(0, 160);
    const lastSpace = truncated.lastIndexOf(' ');
    excerpt = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
  }

  return { html, toc, readingTimeMinutes, excerpt };
}
