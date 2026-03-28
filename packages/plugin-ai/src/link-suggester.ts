/**
 * link-suggester — Analyzes note content to find potential wiki-link targets.
 *
 * Two strategies are combined:
 *   1. Lexical matching — title words found verbatim in the note content.
 *   2. AI-assisted matching — use the LLM to suggest titles semantically
 *      related to the note content (optional, requires a provider).
 *
 * The lexical strategy is always available and works offline.
 */

import type { LinkSuggestion } from './ai-store';

// ---------------------------------------------------------------------------
// Lexical matching
// ---------------------------------------------------------------------------

/**
 * Normalize a string for comparison: lowercase, collapse whitespace.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Escape special regex characters in a string so it can be used as a literal
 * pattern inside a RegExp.
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether `phrase` appears in `content` as a whole-word occurrence.
 * Returns the matched phrase if found, null otherwise.
 */
function findPhrase(content: string, phrase: string): string | null {
  const escaped = escapeRegex(phrase);
  // Word boundary — \b works for ASCII; for Unicode we fall back to space / start/end
  const re = new RegExp(`(?:^|\\s|[^\\w])${escaped}(?:$|\\s|[^\\w])`, 'i');
  return re.test(content) ? phrase : null;
}

/**
 * Score relevance of a note title appearing in the content.
 * Longer title matches score higher (more specific).
 * Normalized frequency also contributes.
 */
function scoreMatch(content: string, title: string): number {
  const normalized = normalize(content);
  const normalizedTitle = normalize(title);

  // Count occurrences
  const escaped = escapeRegex(normalizedTitle);
  const re = new RegExp(escaped, 'gi');
  const matches = normalized.match(re);
  const count = matches?.length ?? 0;

  if (count === 0) return 0;

  // Length bonus: longer titles are more specific → higher relevance
  const lengthBonus = Math.min(normalizedTitle.length / 50, 0.3);

  // Frequency factor: cap at 1.0
  const freqFactor = Math.min(count / 3, 1.0) * 0.7;

  return Math.min(freqFactor + lengthBonus, 1.0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NoteTitleEntry {
  noteId: string;
  title: string;
}

export interface LinkSuggesterOptions {
  /** Minimum relevance score (0–1) to include a suggestion */
  minScore?: number;
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Note IDs already linked from the current note (exclude them) */
  existingLinks?: Set<string>;
}

/**
 * Analyze note content against a list of known note titles and return
 * ranked wiki-link suggestions using lexical matching.
 *
 * @param content - The full text of the note being analyzed
 * @param candidates - All note titles in the workspace
 * @param currentNoteId - ID of the note being analyzed (excluded from results)
 * @param options - Filtering and limit options
 */
export function suggestLinksLexical(
  content: string,
  candidates: NoteTitleEntry[],
  currentNoteId: string,
  options: LinkSuggesterOptions = {},
): LinkSuggestion[] {
  const { minScore = 0.1, limit = 10, existingLinks = new Set() } = options;

  const suggestions: LinkSuggestion[] = [];

  for (const candidate of candidates) {
    // Skip the note itself and already-linked notes
    if (candidate.noteId === currentNoteId) continue;
    if (existingLinks.has(candidate.noteId)) continue;

    // Skip very short titles to avoid false positives (e.g. "AI", "A")
    const titleWords = candidate.title.trim().split(/\s+/);
    if (titleWords.length === 1 && candidate.title.length < 4) continue;

    // Strip common file extension from title
    const cleanTitle = candidate.title.replace(/\.md$/i, '').trim();
    if (!cleanTitle) continue;

    const matchedPhrase = findPhrase(content, cleanTitle);
    if (!matchedPhrase) continue;

    const score = scoreMatch(content, cleanTitle);
    if (score < minScore) continue;

    suggestions.push({
      noteTitle: cleanTitle,
      noteId: candidate.noteId,
      relevance: parseFloat(score.toFixed(3)),
      matchedPhrase,
    });
  }

  // Sort by relevance descending, then alphabetically for stable ordering
  suggestions.sort((a, b) => {
    const diff = b.relevance - a.relevance;
    if (Math.abs(diff) > 0.001) return diff;
    return a.noteTitle.localeCompare(b.noteTitle);
  });

  return suggestions.slice(0, limit);
}

/**
 * Parse a JSON array of note titles returned by the LLM and cross-reference
 * against known notes, returning ranked suggestions.
 *
 * @param aiResponse - JSON string from the LLM (array of title strings)
 * @param candidates - Known note titles for cross-referencing
 * @param currentNoteId - Note being analyzed
 */
export function suggestLinksFromAI(
  aiResponse: string,
  candidates: NoteTitleEntry[],
  currentNoteId: string,
): LinkSuggestion[] {
  let titles: string[];
  try {
    const parsed = JSON.parse(aiResponse) as unknown;
    if (!Array.isArray(parsed)) return [];
    titles = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    // If the model returned prose instead of JSON, try to extract quoted strings
    const quoted = aiResponse.match(/"([^"]+)"/g);
    if (!quoted) return [];
    titles = quoted.map((q) => q.slice(1, -1));
  }

  const candidateMap = new Map(
    candidates.map((c) => [normalize(c.title.replace(/\.md$/i, '')), c]),
  );

  const suggestions: LinkSuggestion[] = [];

  titles.forEach((title, index) => {
    if (!title) return;

    const key = normalize(title.replace(/\.md$/i, ''));
    const entry = candidateMap.get(key);
    if (!entry) return;
    if (entry.noteId === currentNoteId) return;

    // AI-suggested items are scored 1.0 → 0.5 based on order
    const relevance = Math.max(0.5, 1.0 - index * 0.05);

    suggestions.push({
      noteTitle: entry.title.replace(/\.md$/i, ''),
      noteId: entry.noteId,
      relevance: parseFloat(relevance.toFixed(3)),
      matchedPhrase: title,
    });
  });

  return suggestions;
}

/**
 * Merge lexical and AI suggestions, deduplicating by noteId.
 * AI suggestions take priority for relevance score when both match.
 */
export function mergeLinkSuggestions(
  lexical: LinkSuggestion[],
  ai: LinkSuggestion[],
  limit = 10,
): LinkSuggestion[] {
  const merged = new Map<string, LinkSuggestion>();

  // Add AI suggestions first (higher quality)
  for (const s of ai) {
    merged.set(s.noteId, s);
  }

  // Add lexical suggestions that were not already covered by AI
  for (const s of lexical) {
    if (!merged.has(s.noteId)) {
      merged.set(s.noteId, s);
    }
  }

  return [...merged.values()].sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

/**
 * Extract all existing wiki-link targets from a markdown note.
 * Returns the set of link target strings (titles, not IDs).
 */
export function extractExistingWikiLinks(content: string): Set<string> {
  const links = new Set<string>();
  const wikiRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  for (const match of content.matchAll(wikiRe)) {
    const target = match[1]?.trim();
    if (target) {
      links.add(normalize(target));
    }
  }

  return links;
}
