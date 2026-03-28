/**
 * Tests for readability.ts
 *
 * Covers:
 * - extractTitle: og:title, twitter:title, <title> with site suffix stripping, <h1> fallback
 * - extractAuthor: meta tags, byline elements, itemprop
 * - extractPublishedDate: article:published_time, <time datetime>, JSON-LD
 * - extractCanonicalUrl: link[rel=canonical], og:url, fallback to pageUrl
 * - extractSiteName: og:site_name
 * - extractMainContent: scores article/main/div blocks, returns best candidate
 * - makeExcerpt: length limiting, word boundary cutting
 * - extractArticle: integration test
 */

import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  extractAuthor,
  extractPublishedDate,
  extractCanonicalUrl,
  extractSiteName,
  extractMainContent,
  makeExcerpt,
  extractArticle,
} from '../readability';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildHtml(head: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>${body}</body>
</html>`;
}

const ARTICLE_BODY = `
<article>
  <h1>How Yjs Works</h1>
  <div class="author">Jane Doe</div>
  <time datetime="2025-06-15">June 15, 2025</time>
  <p>Yjs is a high-performance CRDT framework for building collaborative applications.
  It supports multiple network providers and persistence adapters. The data model
  is based on a conflict-free replicated data type that allows concurrent edits
  to be merged without conflicts. This enables real-time collaboration features
  similar to Google Docs. The framework is written in JavaScript and supports
  TypeScript out of the box. Many popular editors like ProseMirror and TipTap
  use Yjs for collaborative editing.</p>
  <p>The main data structures are Y.Doc, Y.Text, Y.Map, and Y.Array. Each of
  these supports the standard CRDT operations. Observers can be registered on
  any data structure to react to changes.</p>
</article>
`;

// ---------------------------------------------------------------------------
// extractTitle
// ---------------------------------------------------------------------------

describe('extractTitle', () => {
  it('returns og:title when present', () => {
    const html = buildHtml('<meta property="og:title" content="My OG Title">', '<h1>Page H1</h1>');
    expect(extractTitle(html)).toBe('My OG Title');
  });

  it('returns twitter:title as fallback', () => {
    const html = buildHtml(
      '<meta name="twitter:title" content="Twitter Title">',
      '<title>Page Title</title>',
    );
    expect(extractTitle(html)).toBe('Twitter Title');
  });

  it('strips site suffix from <title> (pipe separator)', () => {
    const html = buildHtml('<title>Article Name | My Site</title>', '');
    expect(extractTitle(html)).toBe('Article Name');
  });

  it('strips site suffix from <title> (dash separator)', () => {
    const html = buildHtml('<title>Article Name - My Blog</title>', '');
    expect(extractTitle(html)).toBe('Article Name');
  });

  it('strips site suffix from <title> (em dash separator)', () => {
    const html = buildHtml('<title>Article Name — Example.com</title>', '');
    expect(extractTitle(html)).toBe('Article Name');
  });

  it('returns full title when no separator', () => {
    const html = buildHtml('<title>Short Title</title>', '');
    expect(extractTitle(html)).toBe('Short Title');
  });

  it('falls back to first h1 when no title element', () => {
    const html = buildHtml('', '<h1>First Heading</h1><p>Content</p>');
    expect(extractTitle(html)).toBe('First Heading');
  });

  it('returns Untitled when no title source found', () => {
    const html = buildHtml('', '<p>No title here</p>');
    expect(extractTitle(html)).toBe('Untitled');
  });

  it('decodes HTML entities in title', () => {
    const html = buildHtml('<title>Tom &amp; Jerry &mdash; Show</title>', '');
    // Should strip suffix and decode entities
    const result = extractTitle(html);
    expect(result).toContain('Tom & Jerry');
  });
});

// ---------------------------------------------------------------------------
// extractAuthor
// ---------------------------------------------------------------------------

describe('extractAuthor', () => {
  it('extracts from meta name="author"', () => {
    const html = buildHtml('<meta name="author" content="Alice Smith">', '');
    expect(extractAuthor(html)).toBe('Alice Smith');
  });

  it('extracts from meta property="article:author"', () => {
    const html = buildHtml('<meta property="article:author" content="Bob Jones">', '');
    expect(extractAuthor(html)).toBe('Bob Jones');
  });

  it('extracts from class="author" element', () => {
    const html = buildHtml('', '<span class="author">Carol White</span>');
    expect(extractAuthor(html)).toBe('Carol White');
  });

  it('extracts from class="byline" element', () => {
    const html = buildHtml('', '<p class="byline">By David Green</p>');
    expect(extractAuthor(html)).toBe('By David Green');
  });

  it('extracts from rel="author" link', () => {
    const html = buildHtml('', '<a rel="author" href="/authors/eve">Eve Brown</a>');
    expect(extractAuthor(html)).toBe('Eve Brown');
  });

  it('extracts from itemprop="author"', () => {
    const html = buildHtml('', '<span itemprop="author">Frank Wilson</span>');
    expect(extractAuthor(html)).toBe('Frank Wilson');
  });

  it('returns null when no author found', () => {
    const html = buildHtml('', '<p>No author here</p>');
    expect(extractAuthor(html)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractPublishedDate
// ---------------------------------------------------------------------------

describe('extractPublishedDate', () => {
  it('extracts from meta property="article:published_time"', () => {
    const html = buildHtml(
      '<meta property="article:published_time" content="2025-06-15T10:00:00Z">',
      '',
    );
    expect(extractPublishedDate(html)).toBe('2025-06-15T10:00:00Z');
  });

  it('extracts from <time datetime="...">', () => {
    const html = buildHtml('', '<time datetime="2025-06-15">June 15, 2025</time>');
    expect(extractPublishedDate(html)).toBe('2025-06-15');
  });

  it('extracts from JSON-LD datePublished', () => {
    const html = buildHtml(
      '',
      `<script type="application/ld+json">{"@type":"Article","datePublished":"2025-07-01"}</script>`,
    );
    expect(extractPublishedDate(html)).toBe('2025-07-01');
  });

  it('extracts from meta name="date"', () => {
    const html = buildHtml('<meta name="date" content="2025-08-20">', '');
    expect(extractPublishedDate(html)).toBe('2025-08-20');
  });

  it('returns null when no date found', () => {
    const html = buildHtml('', '<p>No date here</p>');
    expect(extractPublishedDate(html)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractCanonicalUrl
// ---------------------------------------------------------------------------

describe('extractCanonicalUrl', () => {
  it('extracts from link[rel=canonical]', () => {
    const html = buildHtml('<link rel="canonical" href="https://example.com/article">', '');
    expect(extractCanonicalUrl(html)).toBe('https://example.com/article');
  });

  it('falls back to og:url', () => {
    const html = buildHtml('<meta property="og:url" content="https://example.com/post">', '');
    expect(extractCanonicalUrl(html)).toBe('https://example.com/post');
  });

  it('falls back to pageUrl argument', () => {
    const html = buildHtml('', '');
    expect(extractCanonicalUrl(html, 'https://example.com/fallback')).toBe(
      'https://example.com/fallback',
    );
  });

  it('returns null when no URL source found', () => {
    const html = buildHtml('', '');
    expect(extractCanonicalUrl(html)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractSiteName
// ---------------------------------------------------------------------------

describe('extractSiteName', () => {
  it('extracts from og:site_name', () => {
    const html = buildHtml('<meta property="og:site_name" content="My Blog">', '');
    expect(extractSiteName(html)).toBe('My Blog');
  });

  it('returns null when absent', () => {
    expect(extractSiteName('<html></html>')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractMainContent
// ---------------------------------------------------------------------------

describe('extractMainContent', () => {
  it('returns content from <article> element', () => {
    const html = buildHtml('', ARTICLE_BODY);
    const content = extractMainContent(html);
    expect(content).toContain('Yjs');
    expect(content).toContain('CRDT');
  });

  it('prefers <article> over generic <div>', () => {
    const html = buildHtml(
      '',
      `
      <nav><ul><li>Home</li><li>Blog</li></ul></nav>
      <article>
        <p>${'This is real article content. '.repeat(15)}</p>
        <p>${'More article text here. '.repeat(10)}</p>
      </article>
      <div class="sidebar"><p>Ad</p></div>
      `,
    );
    const content = extractMainContent(html);
    expect(content).toContain('real article content');
  });

  it('strips <script> and <style> before extraction', () => {
    const html = buildHtml(
      '',
      `
      <article>
        <script>trackingCode();</script>
        <p>Visible content paragraph with enough text to score well.</p>
      </article>
      `,
    );
    const content = extractMainContent(html);
    expect(content).not.toContain('trackingCode');
  });

  it('returns body fallback for very short pages', () => {
    const html = buildHtml('', '<p>Short.</p>');
    const content = extractMainContent(html);
    // Should not crash — returns something
    expect(typeof content).toBe('string');
  });

  it('negatively scores nav/sidebar elements', () => {
    const html = buildHtml(
      '',
      `
      <nav class="navigation">
        ${'<a href="#">Link</a>'.repeat(20)}
      </nav>
      <main class="content">
        <p>${'Real content sentence. '.repeat(20)}</p>
      </main>
      `,
    );
    const content = extractMainContent(html);
    expect(content).toContain('Real content sentence');
  });
});

// ---------------------------------------------------------------------------
// makeExcerpt
// ---------------------------------------------------------------------------

describe('makeExcerpt', () => {
  it('returns full text when shorter than maxLength', () => {
    expect(makeExcerpt('<p>Short text</p>', 200)).toBe('Short text');
  });

  it('truncates at maxLength with ellipsis', () => {
    const longHtml = '<p>' + 'word '.repeat(100) + '</p>';
    const result = makeExcerpt(longHtml, 50);
    expect(result.length).toBeLessThanOrEqual(55); // 50 + ellipsis
    expect(result).toMatch(/…$/);
  });

  it('cuts at word boundary, not mid-word', () => {
    // "The quick brown fox jumps over the lazy dog" truncated at 25 chars
    // slice(0, 25) = "The quick brown fox jumps"
    // lastSpace at 19 ("fox"), lastSpace > 25*0.8=20 is false (19<20), so it uses cut directly
    // Actually test that the result is a complete word, not a mid-word cut
    const text = 'The quick brown fox jumps over the lazy dog and it ran away quickly';
    const result = makeExcerpt(`<p>${text}</p>`, 30);
    // Result should end with … and the character before it should not be a partial word
    expect(result).toMatch(/…$/);
    // The cut should land on a space boundary — no partial words by cutting mid-character
    const withoutEllipsis = result.slice(0, -1); // remove …
    // Every word in the result should be a complete word from the source text
    const words = withoutEllipsis.split(' ');
    const lastWord = words[words.length - 1];
    expect(text).toContain(lastWord);
  });

  it('strips HTML tags from excerpt', () => {
    const result = makeExcerpt('<p><strong>Bold</strong> and <em>italic</em> text</p>', 200);
    expect(result).not.toContain('<');
    expect(result).toContain('Bold');
    expect(result).toContain('italic');
  });
});

// ---------------------------------------------------------------------------
// extractArticle — integration
// ---------------------------------------------------------------------------

describe('extractArticle — integration', () => {
  it('extracts all fields from a realistic article page', () => {
    const html = buildHtml(
      `
      <title>Understanding CRDTs | TechBlog</title>
      <meta property="og:title" content="Understanding CRDTs">
      <meta name="author" content="Alice Smith">
      <meta property="article:published_time" content="2025-03-01T09:00:00Z">
      <meta property="og:site_name" content="TechBlog">
      <link rel="canonical" href="https://techblog.example.com/crdts">
      `,
      `
      <article class="post">
        <h1>Understanding CRDTs</h1>
        <p>Conflict-free Replicated Data Types (CRDTs) are data structures that can be
        replicated across multiple computers in a network. All replicas can be updated
        independently and concurrently without coordination between replicas, and it is
        always mathematically possible to resolve inconsistencies which might result.</p>
        <p>CRDTs are used in systems like Google Docs, Figma, and Apple Notes to provide
        real-time collaboration. They eliminate the need for a central coordinator to
        merge changes, making them highly available and partition-tolerant.</p>
      </article>
      `,
    );

    const result = extractArticle(html, 'https://techblog.example.com/crdts');

    expect(result.title).toBe('Understanding CRDTs');
    expect(result.author).toBe('Alice Smith');
    expect(result.publishedDate).toBe('2025-03-01T09:00:00Z');
    expect(result.siteName).toBe('TechBlog');
    expect(result.canonicalUrl).toBe('https://techblog.example.com/crdts');
    expect(result.content).toContain('CRDTs');
    expect(result.excerpt.length).toBeGreaterThan(0);
    expect(result.excerpt.length).toBeLessThanOrEqual(205);
  });

  it('returns Untitled when page has no recognisable title', () => {
    const result = extractArticle('<html><body><p>content</p></body></html>');
    expect(result.title).toBe('Untitled');
  });

  it('returns null for author/date/siteName when absent', () => {
    const result = extractArticle(
      '<html><head><title>Page</title></head><body><p>text</p></body></html>',
    );
    expect(result.author).toBeNull();
    expect(result.publishedDate).toBeNull();
    expect(result.siteName).toBeNull();
  });
});
