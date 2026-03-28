/**
 * Simplified Readability algorithm for article content extraction.
 *
 * Scores DOM-like HTML nodes by text density to identify the main content
 * block of a web page, stripping navigation, ads, sidebars, and boilerplate.
 *
 * This is a pure string/regex implementation — no external DOM library is
 * required, making it portable across browser extensions and Node.js tests.
 *
 * Inspired by Mozilla Readability (Apache-2.0), but rewritten from scratch
 * to avoid the dependency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArticleMetadata {
  /** Extracted article title. */
  title: string;
  /** Author name extracted from Open Graph or byline elements. */
  author: string | null;
  /** Publication date as a string (ISO or human-readable). */
  publishedDate: string | null;
  /** Main article body as cleaned HTML. */
  content: string;
  /** Plain-text excerpt (first ~200 characters of content text). */
  excerpt: string;
  /** Canonical URL from <link rel="canonical"> or og:url. */
  canonicalUrl: string | null;
  /** Site name from og:site_name. */
  siteName: string | null;
}

/** Represents a scored candidate node during content extraction. */
interface ContentCandidate {
  /** The raw outer HTML of this node. */
  html: string;
  /** Inner text length (used for scoring). */
  textLength: number;
  /** Number of commas/punctuation (heuristic for prose density). */
  commaCount: number;
  /** Positive tag class hints (article, content, main, post, etc.). */
  positiveScore: number;
  /** Negative tag class hints (nav, sidebar, footer, ad, etc.). */
  negativeScore: number;
  /** Final computed score. */
  score: number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Tags whose entire subtree should be stripped before scoring. */
const STRIP_TAGS_RE =
  /<(script|style|nav|header|footer|aside|form|button|input|select|textarea|iframe|object|embed|noscript|figure>\s*<figcaption)[^>]*>[\s\S]*?<\/\1>/gi;

/** Class/id patterns that indicate noise (negative signal). */
const NEGATIVE_PATTERN =
  /\b(comment|meta|footer|footnote|masthead|sidebar|sponsor|ad|banner|nav|menu|widget|popup|overlay|modal|cookie|gdpr|share|social|related|recommendation|promoted|advertisement)\b/i;

/** Class/id patterns that indicate content (positive signal). */
const POSITIVE_PATTERN =
  /\b(article|body|content|entry|hentry|main|page|pagination|post|text|blog|story|reader|prose|description)\b/i;

/** Block-level container tags that are candidate wrappers. */
const BLOCK_TAGS = ['div', 'article', 'section', 'main', 'p'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts article metadata and main content from raw page HTML.
 *
 * @param html    - Full page HTML string.
 * @param pageUrl - URL of the page (used for relative URL resolution hints).
 * @returns Extracted article metadata and content.
 */
export function extractArticle(html: string, pageUrl?: string): ArticleMetadata {
  const title = extractTitle(html);
  const author = extractAuthor(html);
  const publishedDate = extractPublishedDate(html);
  const canonicalUrl = extractCanonicalUrl(html, pageUrl);
  const siteName = extractSiteName(html);

  const content = extractMainContent(html);
  const excerpt = makeExcerpt(content, 200);

  return { title, author, publishedDate, content, excerpt, canonicalUrl, siteName };
}

// ---------------------------------------------------------------------------
// Metadata extractors
// ---------------------------------------------------------------------------

/**
 * Extracts the page title in priority order:
 * 1. og:title meta tag
 * 2. twitter:title meta tag
 * 3. <title> element (trimmed to remove site suffix)
 * 4. First <h1> on the page
 */
export function extractTitle(html: string): string {
  // og:title
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) return ogTitle;

  // twitter:title — uses name="" attribute (not property="")
  const twitterTitle = extractMetaName(html, 'twitter:title');
  if (twitterTitle) return twitterTitle;

  // <title> tag — strip common site suffixes like " | Site Name" and " – Blog"
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) {
    const raw = decodeEntities(titleMatch[1].trim());
    // Remove trailing separator + site name (e.g., " | Example" " – Example" " - Example")
    return raw.replace(/\s*[\|\-–—]\s*.{3,}$/, '').trim() || raw;
  }

  // First h1
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1Match) {
    return decodeEntities(stripTags(h1Match[1]).trim());
  }

  return 'Untitled';
}

/**
 * Extracts the article author from:
 * 1. article:author meta
 * 2. og:author / author meta tag
 * 3. Elements with class "author", "byline", or rel="author"
 */
export function extractAuthor(html: string): string | null {
  // Meta tags
  const metaAuthor =
    extractMetaContent(html, 'article:author') ??
    extractMetaContent(html, 'author') ??
    extractMetaName(html, 'author');
  if (metaAuthor) return metaAuthor;

  // Byline elements: <span class="author">, <a rel="author">, etc.
  const bylinePatterns = [
    /<[^>]+\bclass="[^"]*(?:author|byline)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<[^>]+\brel="author"[^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<[^>]+\bitemprop="author"[^>]*>([\s\S]*?)<\/[^>]+>/i,
  ];

  for (const pattern of bylinePatterns) {
    const m = pattern.exec(html);
    if (m) {
      const text = decodeEntities(stripTags(m[1]).trim());
      if (text && text.length < 100) return text;
    }
  }

  return null;
}

/**
 * Extracts the publication date from:
 * 1. article:published_time meta
 * 2. og:published_time meta
 * 3. <time datetime="..."> elements
 * 4. JSON-LD datePublished
 */
export function extractPublishedDate(html: string): string | null {
  // Meta tags
  const metaDate =
    extractMetaContent(html, 'article:published_time') ??
    extractMetaContent(html, 'og:published_time') ??
    extractMetaContent(html, 'pubdate') ??
    extractMetaName(html, 'date') ??
    extractMetaName(html, 'publish-date');
  if (metaDate) return metaDate;

  // <time datetime="...">
  const timeMatch = /<time[^>]+datetime="([^"]+)"[^>]*>/i.exec(html);
  if (timeMatch) return timeMatch[1];

  // JSON-LD: "datePublished": "..."
  const jsonLdMatch = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html);
  if (jsonLdMatch) return jsonLdMatch[1];

  return null;
}

/**
 * Extracts the canonical URL from:
 * 1. <link rel="canonical" href="...">
 * 2. og:url meta
 */
export function extractCanonicalUrl(html: string, pageUrl?: string): string | null {
  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html);
  if (canonical) return canonical[1];

  const ogUrl = extractMetaContent(html, 'og:url');
  if (ogUrl) return ogUrl;

  return pageUrl ?? null;
}

/**
 * Extracts the site name from og:site_name meta.
 */
export function extractSiteName(html: string): string | null {
  return extractMetaContent(html, 'og:site_name');
}

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the main content block from page HTML using a text-density scoring
 * algorithm similar to Mozilla Readability.
 *
 * @param html - Full page HTML.
 * @returns Cleaned HTML of the main content block.
 */
export function extractMainContent(html: string): string {
  // 1. Strip the most common noise elements
  let cleaned = html.replace(STRIP_TAGS_RE, '');

  // 2. Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Score candidate blocks
  const candidates = scoreCandidates(cleaned);

  if (candidates.length === 0) {
    // Fallback: return body content if no candidates scored
    return extractBodyContent(cleaned);
  }

  // 4. Pick the highest-scoring candidate
  const best = candidates.reduce((top, c) => (c.score > top.score ? c : top));

  // 5. Clean the best candidate HTML
  return cleanContent(best.html);
}

/**
 * Scores block-level nodes in the HTML string and returns ranked candidates.
 */
function scoreCandidates(html: string): ContentCandidate[] {
  const candidates: ContentCandidate[] = [];

  for (const tag of BLOCK_TAGS) {
    const tagRegex = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m;
    while ((m = tagRegex.exec(html)) !== null) {
      const attrs = m[1];
      const inner = m[2];

      // Skip very short blocks
      const text = stripTags(inner);
      if (text.length < 100) continue;

      const candidate = scoreNode(m[0], attrs, inner, text);
      if (candidate.score > 0) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function scoreNode(
  outerHtml: string,
  attrs: string,
  inner: string,
  text: string,
): ContentCandidate {
  const textLength = text.length;
  const commaCount = (text.match(/,/g) ?? []).length;

  // Base score: text density
  let score = Math.min(textLength / 100, 30) + Math.min(commaCount / 5, 10);

  // Class/id signals
  const classIdMatch = /(?:class|id)="([^"]*)"/gi;
  let classMatch;
  let positiveScore = 0;
  let negativeScore = 0;

  while ((classMatch = classIdMatch.exec(attrs)) !== null) {
    const value = classMatch[1];
    if (POSITIVE_PATTERN.test(value)) positiveScore += 25;
    if (NEGATIVE_PATTERN.test(value)) negativeScore -= 25;
  }

  // <article> tag gets a strong boost
  if (outerHtml.toLowerCase().startsWith('<article')) positiveScore += 30;
  // <main> tag gets a boost
  if (outerHtml.toLowerCase().startsWith('<main')) positiveScore += 20;

  score += positiveScore + negativeScore;

  // Penalise if text-to-html ratio is very low (link farm / navigation)
  const htmlLength = inner.length;
  const textRatio = htmlLength > 0 ? textLength / htmlLength : 0;
  if (textRatio < 0.2) score -= 15;

  // Boost for having multiple <p> tags (prose indicator)
  const pCount = (inner.match(/<p[^>]*>/gi) ?? []).length;
  score += Math.min(pCount * 3, 20);

  return {
    html: outerHtml,
    textLength,
    commaCount,
    positiveScore,
    negativeScore,
    score,
  };
}

/** Fallback: extract content between <body> tags. */
function extractBodyContent(html: string): string {
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return bodyMatch ? bodyMatch[1] : html;
}

/**
 * Removes residual noise from the extracted content block.
 */
function cleanContent(html: string): string {
  let result = html;

  // Remove inline event handlers
  result = result.replace(/\s+on\w+="[^"]*"/gi, '');

  // Remove style attributes
  result = result.replace(/\s+style="[^"]*"/gi, '');

  // Remove data-* attributes (keep href, src, alt, class)
  result = result.replace(/\s+data-[a-z-]+=(?:"[^"]*"|'[^']*'|\S+)/gi, '');

  // Remove hidden elements
  result = result.replace(/<[^>]+\bhidden\b[^>]*>[\s\S]*?<\/[^>]+>/gi, '');

  // Collapse multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// ---------------------------------------------------------------------------
// Meta tag helpers
// ---------------------------------------------------------------------------

/** Extracts content from <meta property="..." content="..."> */
function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`,
    'i',
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** Extracts content from <meta name="..." content="..."> */
function extractMetaName(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`,
    'i',
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Creates a plain-text excerpt from content HTML, limited to `maxLength` chars.
 */
export function makeExcerpt(html: string, maxLength: number): string {
  const text = stripTags(html).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  // Cut at word boundary
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.8 ? cut.slice(0, lastSpace) : cut) + '…';
}
