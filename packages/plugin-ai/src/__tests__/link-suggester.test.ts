/**
 * Tests for link-suggester — lexical and AI-assisted link detection.
 *
 * Covers:
 * - suggestLinksLexical: exact title matches, scoring, deduplication, exclusions
 * - suggestLinksFromAI: JSON parsing, fallback parsing, note cross-reference
 * - mergeLinkSuggestions: deduplication, ordering, limit
 * - extractExistingWikiLinks: wiki-link extraction from markdown
 */

import { describe, it, expect } from 'vitest';
import {
  suggestLinksLexical,
  suggestLinksFromAI,
  mergeLinkSuggestions,
  extractExistingWikiLinks,
} from '../link-suggester';
import type { NoteTitleEntry } from '../link-suggester';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOTES: NoteTitleEntry[] = [
  { noteId: 'n1', title: 'Machine Learning' },
  { noteId: 'n2', title: 'Neural Networks' },
  { noteId: 'n3', title: 'Deep Learning' },
  { noteId: 'n4', title: 'Transformer Architecture' },
  { noteId: 'n5', title: 'Gradient Descent' },
  { noteId: 'n6', title: 'Backpropagation' },
  { noteId: 'n7', title: 'AI' }, // Too short — should be filtered
];

const CURRENT_NOTE_ID = 'current-note';

// ---------------------------------------------------------------------------
// suggestLinksLexical
// ---------------------------------------------------------------------------

describe('suggestLinksLexical', () => {
  it('finds a note title that appears verbatim in the content', () => {
    const content = 'This note discusses Machine Learning fundamentals.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    const titles = suggestions.map((s) => s.noteTitle);
    expect(titles).toContain('Machine Learning');
  });

  it('is case-insensitive', () => {
    const content = 'We study neural networks and deep learning.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    const titles = suggestions.map((s) => s.noteTitle);
    expect(titles).toContain('Neural Networks');
    expect(titles).toContain('Deep Learning');
  });

  it('excludes the current note from suggestions', () => {
    const content = 'See Machine Learning for details.';
    const notesWithCurrent: NoteTitleEntry[] = [
      ...NOTES,
      { noteId: CURRENT_NOTE_ID, title: 'Machine Learning' },
    ];
    const suggestions = suggestLinksLexical(content, notesWithCurrent, CURRENT_NOTE_ID);
    const ids = suggestions.map((s) => s.noteId);
    expect(ids).not.toContain(CURRENT_NOTE_ID);
  });

  it('excludes notes already linked via existingLinks', () => {
    const content = 'Discusses Machine Learning and Neural Networks.';
    const existing = new Set(['n1']);
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID, {
      existingLinks: existing,
    });
    const ids = suggestions.map((s) => s.noteId);
    expect(ids).not.toContain('n1');
    expect(ids).toContain('n2');
  });

  it('respects the limit option', () => {
    const content =
      'Machine Learning, Neural Networks, Deep Learning, Gradient Descent are all important.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID, { limit: 2 });
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('respects the minScore threshold', () => {
    const content =
      'Machine Learning appears three times: Machine Learning, Machine Learning, Machine Learning.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID, { minScore: 0.9 });
    // Very high threshold — only the most frequent match
    for (const s of suggestions) {
      expect(s.relevance).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('returns empty array when content has no matching titles', () => {
    const content = 'This note is about cooking recipes and soups.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    expect(suggestions).toHaveLength(0);
  });

  it('sorts results by relevance descending', () => {
    const content =
      'Machine Learning Machine Learning Machine Learning and one mention of Neural Networks.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1]!.relevance).toBeGreaterThanOrEqual(suggestions[i]!.relevance);
    }
  });

  it('filters out single-character-title entries (AI = too short)', () => {
    const content = 'This talks about AI and things.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    const ids = suggestions.map((s) => s.noteId);
    expect(ids).not.toContain('n7'); // 'AI' is 2 chars, length < 4
  });

  it('populates the matchedPhrase field', () => {
    const content = 'Introduction to Gradient Descent optimization.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    const gradient = suggestions.find((s) => s.noteId === 'n5');
    expect(gradient?.matchedPhrase).toBeTruthy();
  });

  it('relevance scores are in [0, 1] range', () => {
    const content = 'Deep Learning and Transformer Architecture are foundational.';
    const suggestions = suggestLinksLexical(content, NOTES, CURRENT_NOTE_ID);
    for (const s of suggestions) {
      expect(s.relevance).toBeGreaterThanOrEqual(0);
      expect(s.relevance).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// suggestLinksFromAI
// ---------------------------------------------------------------------------

describe('suggestLinksFromAI', () => {
  it('parses a valid JSON array and cross-references against known notes', () => {
    const aiResponse = JSON.stringify(['Machine Learning', 'Neural Networks', 'Unknown Title']);
    const suggestions = suggestLinksFromAI(aiResponse, NOTES, CURRENT_NOTE_ID);
    const titles = suggestions.map((s) => s.noteTitle);
    expect(titles).toContain('Machine Learning');
    expect(titles).toContain('Neural Networks');
    // 'Unknown Title' has no matching note — excluded
    expect(titles).not.toContain('Unknown Title');
  });

  it('excludes the current note', () => {
    const notesWithCurrent: NoteTitleEntry[] = [
      ...NOTES,
      { noteId: CURRENT_NOTE_ID, title: 'My Note' },
    ];
    const aiResponse = JSON.stringify(['My Note', 'Machine Learning']);
    const suggestions = suggestLinksFromAI(aiResponse, notesWithCurrent, CURRENT_NOTE_ID);
    const ids = suggestions.map((s) => s.noteId);
    expect(ids).not.toContain(CURRENT_NOTE_ID);
  });

  it('is case-insensitive when matching titles', () => {
    const aiResponse = JSON.stringify(['machine learning', 'NEURAL NETWORKS']);
    const suggestions = suggestLinksFromAI(aiResponse, NOTES, CURRENT_NOTE_ID);
    expect(suggestions).toHaveLength(2);
  });

  it('handles malformed JSON by extracting quoted strings', () => {
    const aiResponse = 'I suggest linking to "Machine Learning" and "Deep Learning".';
    const suggestions = suggestLinksFromAI(aiResponse, NOTES, CURRENT_NOTE_ID);
    const titles = suggestions.map((s) => s.noteTitle);
    expect(titles).toContain('Machine Learning');
    expect(titles).toContain('Deep Learning');
  });

  it('returns empty array for a non-array JSON value', () => {
    expect(suggestLinksFromAI('{}', NOTES, CURRENT_NOTE_ID)).toHaveLength(0);
  });

  it('returns empty array for completely unrecognized content', () => {
    expect(suggestLinksFromAI('', NOTES, CURRENT_NOTE_ID)).toHaveLength(0);
  });

  it('first suggestion has higher relevance than later ones', () => {
    const aiResponse = JSON.stringify(['Machine Learning', 'Neural Networks', 'Deep Learning']);
    const suggestions = suggestLinksFromAI(aiResponse, NOTES, CURRENT_NOTE_ID);
    expect(suggestions[0]!.relevance).toBeGreaterThanOrEqual(suggestions[1]!.relevance);
  });
});

// ---------------------------------------------------------------------------
// mergeLinkSuggestions
// ---------------------------------------------------------------------------

describe('mergeLinkSuggestions', () => {
  it('merges lexical and AI suggestions without duplicates', () => {
    const lexical = [
      {
        noteId: 'n1',
        noteTitle: 'Machine Learning',
        relevance: 0.6,
        matchedPhrase: 'Machine Learning',
      },
    ];
    const ai = [
      {
        noteId: 'n1',
        noteTitle: 'Machine Learning',
        relevance: 0.9,
        matchedPhrase: 'Machine Learning',
      },
      {
        noteId: 'n2',
        noteTitle: 'Neural Networks',
        relevance: 0.8,
        matchedPhrase: 'Neural Networks',
      },
    ];

    const merged = mergeLinkSuggestions(lexical, ai);
    const ids = merged.map((s) => s.noteId);

    // n1 should appear once
    expect(ids.filter((id) => id === 'n1')).toHaveLength(1);
    // AI relevance should win for n1
    const n1 = merged.find((s) => s.noteId === 'n1');
    expect(n1?.relevance).toBe(0.9);
  });

  it('adds lexical suggestions not covered by AI', () => {
    const lexical = [
      { noteId: 'n3', noteTitle: 'Deep Learning', relevance: 0.5, matchedPhrase: 'Deep Learning' },
    ];
    const ai = [
      {
        noteId: 'n1',
        noteTitle: 'Machine Learning',
        relevance: 0.9,
        matchedPhrase: 'Machine Learning',
      },
    ];

    const merged = mergeLinkSuggestions(lexical, ai);
    const ids = merged.map((s) => s.noteId);
    expect(ids).toContain('n3');
  });

  it('respects the limit parameter', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      noteId: `n${i}`,
      noteTitle: `Note ${i}`,
      relevance: Math.random(),
      matchedPhrase: `note ${i}`,
    }));
    const merged = mergeLinkSuggestions(many, [], 5);
    expect(merged).toHaveLength(5);
  });

  it('returns results sorted by relevance descending', () => {
    const lexical = [
      { noteId: 'a', noteTitle: 'A', relevance: 0.3, matchedPhrase: 'a' },
      { noteId: 'b', noteTitle: 'B', relevance: 0.9, matchedPhrase: 'b' },
    ];
    const merged = mergeLinkSuggestions(lexical, []);
    expect(merged[0]!.relevance).toBeGreaterThanOrEqual(merged[1]!.relevance);
  });
});

// ---------------------------------------------------------------------------
// extractExistingWikiLinks
// ---------------------------------------------------------------------------

describe('extractExistingWikiLinks', () => {
  it('extracts simple wiki links', () => {
    const content = 'See [[Machine Learning]] for more.';
    const links = extractExistingWikiLinks(content);
    expect(links.has('machine learning')).toBe(true);
  });

  it('extracts aliased wiki links, keeping target', () => {
    const content = 'See [[Machine Learning|ML]] for more.';
    const links = extractExistingWikiLinks(content);
    expect(links.has('machine learning')).toBe(true);
  });

  it('extracts multiple links', () => {
    const content = '[[Note A]] and [[Note B]] are related.';
    const links = extractExistingWikiLinks(content);
    expect(links.has('note a')).toBe(true);
    expect(links.has('note b')).toBe(true);
  });

  it('returns empty set when no links present', () => {
    const content = 'Plain text with no links.';
    expect(extractExistingWikiLinks(content).size).toBe(0);
  });

  it('normalizes to lowercase', () => {
    const content = '[[DeepLearning]]';
    const links = extractExistingWikiLinks(content);
    expect(links.has('deeplearning')).toBe(true);
  });
});
