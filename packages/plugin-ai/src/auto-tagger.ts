/**
 * auto-tagger — Extract keywords and topics from note content for tag suggestions.
 *
 * Two strategies:
 *   1. Statistical (TF-IDF-like) keyword extraction — fast, no API required.
 *   2. AI-assisted extraction — parse LLM JSON response into tag suggestions.
 *
 * The statistical extractor is always available and produces useful results
 * without network access.
 */

import type { TagSuggestion } from './ai-store';

// ---------------------------------------------------------------------------
// Stop words (English)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'up',
  'about',
  'into',
  'through',
  'during',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'not',
  'no',
  'nor',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'than',
  'too',
  'very',
  'just',
  'also',
  'its',
  'it',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'they',
  'his',
  'her',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'all',
  'any',
  'same',
  'as',
  'if',
  'then',
  'once',
  'here',
  'there',
  'while',
  'after',
  'before',
  'under',
  'over',
  'between',
  'out',
  'off',
  'above',
  'below',
  'between',
  'every',
  'own',
]);

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

/** Strip markdown syntax from content before tokenization */
function stripMarkdown(content: string): string {
  return (
    content
      // Remove YAML frontmatter
      .replace(/^---[\s\S]*?---\n?/, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, ' ')
      // Remove bold/italic markers
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Remove wiki links — extract the display text
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias ?? target)
      // Remove markdown links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Tokenize text into words: lowercase, strip punctuation, min length 3.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

// ---------------------------------------------------------------------------
// Statistical keyword extraction
// ---------------------------------------------------------------------------

interface WordStats {
  word: string;
  count: number;
  /** Normalized relative frequency in the document */
  tf: number;
}

/**
 * Compute term frequency (TF) for each token.
 * Returns tokens sorted by frequency descending.
 */
function computeTermFrequency(tokens: string[]): WordStats[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const total = tokens.length || 1;
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count, tf: count / total }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Convert a word to a tag-friendly slug: lowercase, hyphens.
 */
function toTagSlug(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract statistical keyword-based tag suggestions from plain text.
 *
 * Uses term frequency as a proxy for importance. Filters out numbers,
 * very common words, and tokens shorter than 4 characters.
 */
export function extractTagsStatistical(
  content: string,
  options: {
    maxTags?: number;
    minWordLength?: number;
    minCount?: number;
  } = {},
): TagSuggestion[] {
  const { maxTags = 8, minWordLength = 4, minCount = 2 } = options;

  const stripped = stripMarkdown(content);
  const tokens = tokenize(stripped).filter((t) => t.length >= minWordLength);

  if (tokens.length === 0) return [];

  const stats = computeTermFrequency(tokens);

  // Filter out words that appear only once in short documents
  const eligible = stats.filter((s) => s.count >= minCount || tokens.length < 100);

  // Score: normalized between 0 and 1 based on rank
  const top = eligible.slice(0, maxTags * 2);
  const maxTf = top[0]?.tf ?? 1;

  const suggestions: TagSuggestion[] = [];

  for (const stat of top) {
    const slug = toTagSlug(stat.word);
    if (!slug || slug.length < 3) continue;

    // Skip numeric-only slugs
    if (/^\d+$/.test(slug)) continue;

    const confidence = parseFloat((stat.tf / maxTf).toFixed(3));

    suggestions.push({ tag: slug, confidence });

    if (suggestions.length >= maxTags) break;
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// AI-assisted tag extraction
// ---------------------------------------------------------------------------

/**
 * Parse a JSON array of tag strings returned by the LLM.
 *
 * The LLM is prompted to return lowercase, hyphen-separated tags.
 * This function normalizes and validates the output.
 */
export function extractTagsFromAI(
  aiResponse: string,
  options: { maxTags?: number } = {},
): TagSuggestion[] {
  const { maxTags = 8 } = options;

  let tags: string[];
  try {
    const parsed = JSON.parse(aiResponse) as unknown;
    if (!Array.isArray(parsed)) return [];
    tags = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    // Try to extract quoted strings if the model ignored our JSON instruction
    const quoted = aiResponse.match(/"([^"]+)"/g);
    if (!quoted) {
      // Last resort: split comma-separated or line-separated
      tags = aiResponse
        .split(/[,\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      tags = quoted.map((q) => q.slice(1, -1));
    }
  }

  const suggestions: TagSuggestion[] = [];

  tags.forEach((tag, index) => {
    if (!tag) return;

    const slug = toTagSlug(tag.toLowerCase());
    if (!slug || slug.length < 2) return;
    if (/^\d+$/.test(slug)) return;

    // AI suggestions are scored 1.0 → 0.5 based on order (model confidence proxy)
    const confidence = parseFloat(Math.max(0.5, 1.0 - index * 0.07).toFixed(3));
    suggestions.push({ tag: slug, confidence });
  });

  return suggestions.slice(0, maxTags);
}

// ---------------------------------------------------------------------------
// Tag merging and deduplication
// ---------------------------------------------------------------------------

/**
 * Merge statistical and AI tag suggestions, deduplicating by tag value.
 * AI suggestions take priority for confidence scores.
 */
export function mergeTagSuggestions(
  statistical: TagSuggestion[],
  ai: TagSuggestion[],
  limit = 8,
): TagSuggestion[] {
  const merged = new Map<string, TagSuggestion>();

  for (const s of ai) {
    merged.set(s.tag, s);
  }

  for (const s of statistical) {
    if (!merged.has(s.tag)) {
      merged.set(s.tag, s);
    }
  }

  return [...merged.values()].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

/**
 * Filter suggestions against an existing set of tags applied to the note.
 * Returns only suggestions not already applied.
 */
export function filterAppliedTags(
  suggestions: TagSuggestion[],
  appliedTags: string[],
): TagSuggestion[] {
  const applied = new Set(appliedTags.map((t) => t.toLowerCase().replace(/^#/, '')));
  return suggestions.filter((s) => !applied.has(s.tag));
}

/**
 * Extract YAML frontmatter tags from note content.
 * Supports both `tags: [a, b]` and `tags:\n  - a\n  - b` formats.
 */
export function extractFrontmatterTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const frontmatter = fmMatch[1] ?? '';

  // Inline array format: tags: [a, b, c]
  const inlineMatch = frontmatter.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  // Block list format: tags:\n  - a\n  - b
  const blockMatch = frontmatter.match(/^tags:\s*\n((?:\s+-\s+\S.*\n?)*)/m);
  if (blockMatch) {
    return (blockMatch[1] ?? '')
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s+-\s+/, '')
          .trim()
          .replace(/^["']|["']$/g, ''),
      )
      .filter(Boolean);
  }

  return [];
}
