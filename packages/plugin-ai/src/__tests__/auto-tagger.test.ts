/**
 * Tests for auto-tagger — keyword extraction and tag suggestion logic.
 *
 * Covers:
 * - extractTagsStatistical: term frequency, stop words, normalization
 * - extractTagsFromAI: JSON parsing, fallback parsing, normalization
 * - mergeTagSuggestions: deduplication, ordering, AI priority
 * - filterAppliedTags: exclusion of already-applied tags
 * - extractFrontmatterTags: YAML frontmatter parsing, inline and block formats
 */

import { describe, it, expect } from 'vitest';
import {
  extractTagsStatistical,
  extractTagsFromAI,
  mergeTagSuggestions,
  filterAppliedTags,
  extractFrontmatterTags,
} from '../auto-tagger';

// ---------------------------------------------------------------------------
// extractTagsStatistical
// ---------------------------------------------------------------------------

describe('extractTagsStatistical', () => {
  it('extracts frequent topic words as tags', () => {
    const content = `
Machine learning is a branch of artificial intelligence.
Deep learning and machine learning are powerful techniques.
Neural networks form the basis of deep learning research.
Machine learning applications include computer vision and NLP.
    `;
    const tags = extractTagsStatistical(content);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain('learning');
    expect(tagNames).toContain('machine');
  });

  it('excludes stop words', () => {
    const content = 'This is a very important note about the system and its features.';
    const tags = extractTagsStatistical(content);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).not.toContain('this');
    expect(tagNames).not.toContain('and');
    expect(tagNames).not.toContain('the');
    expect(tagNames).not.toContain('its');
  });

  it('returns at most maxTags suggestions', () => {
    const content = Array.from({ length: 100 }, (_, i) => `word${i} word${i}`).join(' ');
    const tags = extractTagsStatistical(content, { maxTags: 5 });
    expect(tags.length).toBeLessThanOrEqual(5);
  });

  it('produces slugs (lowercase, hyphenated)', () => {
    const content = 'JavaScript TypeScript React testing tools';
    const tags = extractTagsStatistical(content);
    for (const tag of tags) {
      expect(tag.tag).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('confidence scores are in [0, 1] range', () => {
    const content = 'Testing confidence scoring in automatic tagging systems.';
    const tags = extractTagsStatistical(content);
    for (const tag of tags) {
      expect(tag.confidence).toBeGreaterThanOrEqual(0);
      expect(tag.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('returns empty array for empty content', () => {
    expect(extractTagsStatistical('')).toHaveLength(0);
  });

  it('strips markdown formatting before tokenizing', () => {
    // The stripper removes code blocks and frontmatter.
    // Bold/italic markers are stripped but the words inside are kept —
    // that is intentional so meaningful words like "neural-networks" remain.
    // We verify that code-block content and frontmatter keys are excluded.
    const content = `---
title: My Note
---
# Heading
**Bold text** about machine-learning and _italic_ neural-networks.
\`\`\`python
code_block_ignore_this_token_xyz
\`\`\`
`;
    const tags = extractTagsStatistical(content);
    const tagNames = tags.map((t) => t.tag);
    // Code block content should not appear as a tag (it's a unique token that
    // would have a frequency of 1 and be filtered by minCount in longer docs;
    // for this small doc we just verify the unique nonsense word is not there)
    expect(tagNames).not.toContain('code-block-ignore-this-token-xyz');
    // Frontmatter title value should not appear
    expect(tagNames).not.toContain('my-note');
  });

  it('does not include pure numeric tokens as tags', () => {
    const content = '2024 2025 version 1 2 3 hundred times';
    const tags = extractTagsStatistical(content);
    for (const tag of tags) {
      expect(/^\d+$/.test(tag.tag)).toBe(false);
    }
  });

  it('respects minWordLength option', () => {
    const content = 'cat the dog has big ears and a warm home today';
    const tags = extractTagsStatistical(content, { minWordLength: 5 });
    for (const tag of tags) {
      expect(tag.tag.length).toBeGreaterThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// extractTagsFromAI
// ---------------------------------------------------------------------------

describe('extractTagsFromAI', () => {
  it('parses a valid JSON array of tags', () => {
    const aiResponse = JSON.stringify(['machine-learning', 'deep-learning', 'nlp']);
    const tags = extractTagsFromAI(aiResponse);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain('machine-learning');
    expect(tagNames).toContain('deep-learning');
    expect(tagNames).toContain('nlp');
  });

  it('normalizes tags to lowercase slug format', () => {
    const aiResponse = JSON.stringify(['Machine Learning', 'Deep_Learning', 'NLP Tools']);
    const tags = extractTagsFromAI(aiResponse);
    for (const tag of tags) {
      expect(tag.tag).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('handles malformed JSON by extracting quoted strings', () => {
    const aiResponse = 'Based on the content, I suggest: "machine-learning", "transformers"';
    const tags = extractTagsFromAI(aiResponse);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain('machine-learning');
    expect(tagNames).toContain('transformers');
  });

  it('handles comma-separated strings as last resort', () => {
    const aiResponse = 'machine-learning, deep-learning, nlp';
    const tags = extractTagsFromAI(aiResponse);
    expect(tags.length).toBeGreaterThan(0);
  });

  it('returns at most maxTags suggestions', () => {
    const aiResponse = JSON.stringify(Array.from({ length: 20 }, (_, i) => `tag-${i}`));
    const tags = extractTagsFromAI(aiResponse, { maxTags: 5 });
    expect(tags.length).toBeLessThanOrEqual(5);
  });

  it('confidence scores are in [0.5, 1.0] range for AI suggestions', () => {
    const aiResponse = JSON.stringify(['a-tag', 'b-tag', 'c-tag']);
    const tags = extractTagsFromAI(aiResponse);
    for (const tag of tags) {
      expect(tag.confidence).toBeGreaterThanOrEqual(0.5);
      expect(tag.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it('first AI suggestion has higher confidence than later ones', () => {
    const aiResponse = JSON.stringify(['first', 'second', 'third']);
    const tags = extractTagsFromAI(aiResponse);
    expect(tags[0]!.confidence).toBeGreaterThanOrEqual(tags[1]!.confidence);
    expect(tags[1]!.confidence).toBeGreaterThanOrEqual(tags[2]!.confidence);
  });

  it('returns empty array for non-array JSON', () => {
    expect(extractTagsFromAI('{"tag":"value"}')).toHaveLength(0);
  });

  it('filters out very short tags', () => {
    const aiResponse = JSON.stringify(['a', 'ml', 'deep-learning']);
    const tags = extractTagsFromAI(aiResponse);
    const tagNames = tags.map((t) => t.tag);
    // 'a' is 1 char — filtered; 'ml' is 2 chars — filtered
    expect(tagNames).not.toContain('a');
    // 'deep-learning' should remain
    expect(tagNames).toContain('deep-learning');
  });

  it('does not include purely numeric tags', () => {
    const aiResponse = JSON.stringify(['2024', 'machine-learning', '42']);
    const tags = extractTagsFromAI(aiResponse);
    for (const tag of tags) {
      expect(/^\d+$/.test(tag.tag)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// mergeTagSuggestions
// ---------------------------------------------------------------------------

describe('mergeTagSuggestions', () => {
  it('merges without duplicates', () => {
    const statistical = [
      { tag: 'machine-learning', confidence: 0.6 },
      { tag: 'neural-networks', confidence: 0.4 },
    ];
    const ai = [
      { tag: 'machine-learning', confidence: 0.9 },
      { tag: 'transformers', confidence: 0.8 },
    ];

    const merged = mergeTagSuggestions(statistical, ai);
    const tags = merged.map((t) => t.tag);
    expect(tags.filter((t) => t === 'machine-learning')).toHaveLength(1);
  });

  it('AI suggestion takes priority for confidence', () => {
    const statistical = [{ tag: 'ml', confidence: 0.4 }];
    const ai = [{ tag: 'ml', confidence: 0.9 }];
    const merged = mergeTagSuggestions(statistical, ai);
    const mlTag = merged.find((t) => t.tag === 'ml');
    expect(mlTag?.confidence).toBe(0.9);
  });

  it('adds statistical tags not covered by AI', () => {
    const statistical = [{ tag: 'backprop', confidence: 0.5 }];
    const ai = [{ tag: 'deep-learning', confidence: 0.9 }];
    const merged = mergeTagSuggestions(statistical, ai);
    const tags = merged.map((t) => t.tag);
    expect(tags).toContain('backprop');
  });

  it('respects limit parameter', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      tag: `tag-${i}`,
      confidence: Math.random(),
    }));
    const merged = mergeTagSuggestions(many, [], 5);
    expect(merged).toHaveLength(5);
  });

  it('returns results sorted by confidence descending', () => {
    const statistical = [
      { tag: 'low', confidence: 0.2 },
      { tag: 'high', confidence: 0.8 },
    ];
    const merged = mergeTagSuggestions(statistical, []);
    expect(merged[0]!.confidence).toBeGreaterThanOrEqual(merged[1]!.confidence);
  });
});

// ---------------------------------------------------------------------------
// filterAppliedTags
// ---------------------------------------------------------------------------

describe('filterAppliedTags', () => {
  const suggestions = [
    { tag: 'machine-learning', confidence: 0.9 },
    { tag: 'deep-learning', confidence: 0.8 },
    { tag: 'neural-networks', confidence: 0.7 },
  ];

  it('removes already-applied tags from suggestions', () => {
    const filtered = filterAppliedTags(suggestions, ['machine-learning']);
    const tags = filtered.map((t) => t.tag);
    expect(tags).not.toContain('machine-learning');
    expect(tags).toContain('deep-learning');
  });

  it('handles tags with # prefix in appliedTags', () => {
    const filtered = filterAppliedTags(suggestions, ['#deep-learning']);
    const tags = filtered.map((t) => t.tag);
    expect(tags).not.toContain('deep-learning');
  });

  it('is case-insensitive', () => {
    const filtered = filterAppliedTags(suggestions, ['MACHINE-LEARNING']);
    const tags = filtered.map((t) => t.tag);
    expect(tags).not.toContain('machine-learning');
  });

  it('returns all suggestions when appliedTags is empty', () => {
    expect(filterAppliedTags(suggestions, [])).toHaveLength(3);
  });

  it('returns empty array when all suggestions are already applied', () => {
    const applied = suggestions.map((s) => s.tag);
    expect(filterAppliedTags(suggestions, applied)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractFrontmatterTags
// ---------------------------------------------------------------------------

describe('extractFrontmatterTags', () => {
  it('parses inline array format: tags: [a, b, c]', () => {
    const content = `---
title: My Note
tags: [machine-learning, deep-learning, nlp]
---
Note body here.
`;
    const tags = extractFrontmatterTags(content);
    expect(tags).toEqual(['machine-learning', 'deep-learning', 'nlp']);
  });

  it('parses block list format', () => {
    const content = `---
title: My Note
tags:
  - machine-learning
  - deep-learning
  - research
---
Note body.
`;
    const tags = extractFrontmatterTags(content);
    expect(tags).toContain('machine-learning');
    expect(tags).toContain('deep-learning');
    expect(tags).toContain('research');
  });

  it('returns empty array when no tags key present', () => {
    const content = `---
title: My Note
author: Alice
---
Body.
`;
    expect(extractFrontmatterTags(content)).toHaveLength(0);
  });

  it('returns empty array when no frontmatter present', () => {
    const content = 'Just a plain note without frontmatter.';
    expect(extractFrontmatterTags(content)).toHaveLength(0);
  });

  it('strips quotes from tag values', () => {
    const content = `---
tags: ["machine-learning", 'deep-learning']
---
`;
    const tags = extractFrontmatterTags(content);
    expect(tags).toContain('machine-learning');
    expect(tags).toContain('deep-learning');
  });
});
