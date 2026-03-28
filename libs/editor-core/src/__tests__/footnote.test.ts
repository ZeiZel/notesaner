/**
 * Unit tests for the Footnote TipTap extension.
 *
 * Strategy (same approach as wiki-link.test.ts):
 *   - Test all pure logic functions independently — no DOM, no editor instance.
 *   - Regex, serialization helpers, label utilities, and id helpers are covered
 *     with direct unit tests.
 *   - Extension node / NodeView integration is covered by Playwright e2e tests.
 *
 * Coverage targets (from vitest.config.ts):
 *   lines: 80 %  /  branches: 70 %  /  functions: 80 %
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Isolate the pure helpers by importing them directly.
// The extension file imports @tiptap/core which requires a DOM, so we import
// only the exported functions — not the Node.create() instances — to stay
// environment-agnostic.
// ---------------------------------------------------------------------------

import {
  collectUsedLabels,
  nextAvailableLabel,
  footnoteRefId,
  footnoteDefId,
  serializeFootnoteRef,
  serializeFootnoteDefPrefix,
  FOOTNOTE_REF_INPUT_REGEX,
} from '../extensions/footnote';

// ---------------------------------------------------------------------------
// Helper: build a lightweight ProseMirror-compatible doc stub
// ---------------------------------------------------------------------------

/**
 * Creates a minimal doc-like object with a `descendants` method that iterates
 * over a flat list of `{type: {name}, attrs}` node stubs.
 * This avoids importing @tiptap/pm/model (which requires jsdom) in pure tests.
 */
function makeDocStub(
  nodes: Array<{ typeName: string; attrs: Record<string, string> }>,
): import('@tiptap/pm/model').Node {
  return {
    descendants(
      cb: (node: { type: { name: string }; attrs: Record<string, string> }, pos: number) => void,
    ) {
      nodes.forEach((n, i) => cb({ type: { name: n.typeName }, attrs: n.attrs }, i));
    },
  } as unknown as import('@tiptap/pm/model').Node;
}

// ===========================================================================
// 1. FOOTNOTE_REF_INPUT_REGEX
// ===========================================================================

describe('FOOTNOTE_REF_INPUT_REGEX', () => {
  function match(input: string) {
    return FOOTNOTE_REF_INPUT_REGEX.exec(input);
  }

  // ---- Happy path ----------------------------------------------------------

  it('matches a numeric footnote reference [^1]', () => {
    const m = match('[^1]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('1');
  });

  it('matches [^42] (multi-digit)', () => {
    const m = match('[^42]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('42');
  });

  it('matches a named footnote reference [^note-id]', () => {
    const m = match('[^note-id]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('note-id');
  });

  it('matches [^abc] at end of a sentence', () => {
    const m = match('Some text [^abc]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('abc');
  });

  it('matches [^123-abc] (mixed alphanumeric)', () => {
    const m = match('[^123-abc]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('123-abc');
  });

  // ---- Non-matching cases --------------------------------------------------

  it('does not match an empty label [^]', () => {
    // FOOTNOTE_REF_INPUT_REGEX requires at least one non-whitespace char
    const m = match('[^]');
    expect(m).toBeNull();
  });

  it('does not match a label with whitespace [^foo bar]', () => {
    const m = match('[^foo bar]');
    expect(m).toBeNull();
  });

  it('does not match standard markdown link [text](url)', () => {
    const m = match('[text](url)');
    expect(m).toBeNull();
  });

  it('does not match an unclosed bracket [^1', () => {
    const m = match('[^1');
    expect(m).toBeNull();
  });

  it('does not match a wiki link [[Note]]', () => {
    const m = match('[[Note]]');
    expect(m).toBeNull();
  });

  it('does not match when [^ is not followed by a non-bracket char', () => {
    const m = match('[^]');
    expect(m).toBeNull();
  });

  // ---- Edge cases ----------------------------------------------------------

  it('requires the match to be at the END of the string ($)', () => {
    // The regex uses $ so [^1] in the middle of more text won't match.
    const m = match('[^1] some more text');
    expect(m).toBeNull();
  });

  it('matches [^1] when it is the very last thing in the string', () => {
    const m = match('Introducing a concept[^1]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('1');
  });
});

// ===========================================================================
// 2. collectUsedLabels
// ===========================================================================

describe('collectUsedLabels', () => {
  it('returns an empty set when document has no footnoteRef nodes', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', attrs: {} },
      { typeName: 'heading', attrs: {} },
    ]);
    expect(collectUsedLabels(doc).size).toBe(0);
  });

  it('collects a single numeric label', () => {
    const doc = makeDocStub([{ typeName: 'footnoteRef', attrs: { label: '1' } }]);
    const used = collectUsedLabels(doc);
    expect(used.has(1)).toBe(true);
    expect(used.size).toBe(1);
  });

  it('collects multiple labels without duplicates', () => {
    const doc = makeDocStub([
      { typeName: 'footnoteRef', attrs: { label: '1' } },
      { typeName: 'footnoteRef', attrs: { label: '2' } },
      { typeName: 'footnoteRef', attrs: { label: '3' } },
    ]);
    const used = collectUsedLabels(doc);
    expect(used.size).toBe(3);
    expect(used.has(1)).toBe(true);
    expect(used.has(2)).toBe(true);
    expect(used.has(3)).toBe(true);
  });

  it('ignores non-footnoteRef nodes', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', attrs: { label: '99' } },
      { typeName: 'footnoteDef', attrs: { label: '1' } }, // def, not ref
      { typeName: 'footnoteRef', attrs: { label: '5' } },
    ]);
    const used = collectUsedLabels(doc);
    expect(used.size).toBe(1);
    expect(used.has(5)).toBe(true);
  });

  it('handles non-numeric labels gracefully (NaN skipped)', () => {
    const doc = makeDocStub([{ typeName: 'footnoteRef', attrs: { label: 'named-ref' } }]);
    // parseInt('named-ref', 10) → NaN, which should not be added
    const used = collectUsedLabels(doc);
    expect(used.size).toBe(0);
  });

  it('handles duplicate labels (only stored once in Set)', () => {
    const doc = makeDocStub([
      { typeName: 'footnoteRef', attrs: { label: '2' } },
      { typeName: 'footnoteRef', attrs: { label: '2' } },
    ]);
    const used = collectUsedLabels(doc);
    expect(used.size).toBe(1);
    expect(used.has(2)).toBe(true);
  });
});

// ===========================================================================
// 3. nextAvailableLabel
// ===========================================================================

describe('nextAvailableLabel', () => {
  it('returns 1 when no labels are used', () => {
    expect(nextAvailableLabel(new Set())).toBe(1);
  });

  it('returns 1 when used set does not contain 1', () => {
    expect(nextAvailableLabel(new Set([2, 3]))).toBe(1);
  });

  it('returns 2 when 1 is already used', () => {
    expect(nextAvailableLabel(new Set([1]))).toBe(2);
  });

  it('returns 3 when 1 and 2 are used', () => {
    expect(nextAvailableLabel(new Set([1, 2]))).toBe(3);
  });

  it('fills the first gap in a non-contiguous sequence', () => {
    // 1 used, 2 NOT used → next should be 2
    expect(nextAvailableLabel(new Set([1, 3, 4]))).toBe(2);
  });

  it('continues past a large contiguous block', () => {
    const used = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(nextAvailableLabel(used)).toBe(11);
  });

  it('always returns a positive integer', () => {
    const result = nextAvailableLabel(new Set());
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ===========================================================================
// 4. footnoteRefId / footnoteDefId
// ===========================================================================

describe('footnoteRefId', () => {
  it('prefixes with "fnref-"', () => {
    expect(footnoteRefId('1')).toBe('fnref-1');
  });

  it('handles multi-digit labels', () => {
    expect(footnoteRefId('42')).toBe('fnref-42');
  });

  it('handles named labels', () => {
    expect(footnoteRefId('my-note')).toBe('fnref-my-note');
  });

  it('is a valid HTML id (no spaces)', () => {
    const id = footnoteRefId('abc');
    expect(id).not.toContain(' ');
    expect(id).toMatch(/^fnref-/);
  });
});

describe('footnoteDefId', () => {
  it('prefixes with "fndef-"', () => {
    expect(footnoteDefId('1')).toBe('fndef-1');
  });

  it('handles multi-digit labels', () => {
    expect(footnoteDefId('100')).toBe('fndef-100');
  });

  it('handles named labels', () => {
    expect(footnoteDefId('my-note')).toBe('fndef-my-note');
  });

  it('is a valid HTML id (no spaces)', () => {
    const id = footnoteDefId('abc');
    expect(id).not.toContain(' ');
    expect(id).toMatch(/^fndef-/);
  });
});

describe('footnoteRefId and footnoteDefId produce different ids for same label', () => {
  it('ref and def ids are distinct for label "1"', () => {
    expect(footnoteRefId('1')).not.toBe(footnoteDefId('1'));
  });

  it('ref and def ids are distinct for any label', () => {
    for (const label of ['1', '2', '99', 'xyz']) {
      expect(footnoteRefId(label)).not.toBe(footnoteDefId(label));
    }
  });
});

// ===========================================================================
// 5. serializeFootnoteRef / serializeFootnoteDefPrefix
// ===========================================================================

describe('serializeFootnoteRef', () => {
  it('produces [^1] for label "1"', () => {
    expect(serializeFootnoteRef('1')).toBe('[^1]');
  });

  it('produces [^42] for label "42"', () => {
    expect(serializeFootnoteRef('42')).toBe('[^42]');
  });

  it('preserves named labels', () => {
    expect(serializeFootnoteRef('my-note')).toBe('[^my-note]');
  });

  it('round-trips through FOOTNOTE_REF_INPUT_REGEX', () => {
    // The output of serializeFootnoteRef should match the input rule regex.
    const serialized = serializeFootnoteRef('7');
    const m = FOOTNOTE_REF_INPUT_REGEX.exec(serialized);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('7');
  });

  it('always wraps in [^ and ]', () => {
    for (const label of ['1', '2', '99', 'xyz']) {
      const result = serializeFootnoteRef(label);
      expect(result.startsWith('[^')).toBe(true);
      expect(result.endsWith(']')).toBe(true);
    }
  });
});

describe('serializeFootnoteDefPrefix', () => {
  it('produces "[^1]: " for label "1"', () => {
    expect(serializeFootnoteDefPrefix('1')).toBe('[^1]: ');
  });

  it('produces "[^42]: " for label "42"', () => {
    expect(serializeFootnoteDefPrefix('42')).toBe('[^42]: ');
  });

  it('preserves named labels', () => {
    expect(serializeFootnoteDefPrefix('my-note')).toBe('[^my-note]: ');
  });

  it('always ends with ": " (colon + space)', () => {
    for (const label of ['1', '5', 'abc']) {
      const result = serializeFootnoteDefPrefix(label);
      expect(result.endsWith(': ')).toBe(true);
    }
  });

  it('starts with "[^"', () => {
    expect(serializeFootnoteDefPrefix('3').startsWith('[^')).toBe(true);
  });
});

// ===========================================================================
// 6. Markdown round-trip: ref ↔ input-regex
// ===========================================================================

describe('Markdown round-trip', () => {
  it('serializeFootnoteRef output is parseable by FOOTNOTE_REF_INPUT_REGEX', () => {
    for (const label of ['1', '2', '10', '99']) {
      const md = serializeFootnoteRef(label);
      const m = FOOTNOTE_REF_INPUT_REGEX.exec(md);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(label);
    }
  });

  it('serializeFootnoteDefPrefix uses the same label as serializeFootnoteRef', () => {
    const label = '5';
    const refMd = serializeFootnoteRef(label);
    const defMd = serializeFootnoteDefPrefix(label);
    // Both should contain the label string between [^ and ]
    expect(refMd).toContain(label);
    expect(defMd).toContain(label);
  });

  it('definition prefix and ref share the same label bracket syntax', () => {
    const label = '3';
    // [^3] vs [^3]:
    expect(serializeFootnoteRef(label)).toBe('[^3]');
    expect(serializeFootnoteDefPrefix(label)).toBe('[^3]: ');
  });
});

// ===========================================================================
// 7. Auto-numbering integration: collectUsedLabels + nextAvailableLabel
// ===========================================================================

describe('Auto-numbering integration', () => {
  it('first footnote in empty doc gets label 1', () => {
    const doc = makeDocStub([]);
    const used = collectUsedLabels(doc);
    expect(nextAvailableLabel(used)).toBe(1);
  });

  it('second footnote gets label 2 when only 1 exists', () => {
    const doc = makeDocStub([{ typeName: 'footnoteRef', attrs: { label: '1' } }]);
    const used = collectUsedLabels(doc);
    expect(nextAvailableLabel(used)).toBe(2);
  });

  it('fills a gap: skips 1, 3, assigns 2', () => {
    const doc = makeDocStub([
      { typeName: 'footnoteRef', attrs: { label: '1' } },
      { typeName: 'footnoteRef', attrs: { label: '3' } },
    ]);
    const used = collectUsedLabels(doc);
    expect(nextAvailableLabel(used)).toBe(2);
  });

  it('assigns sequential labels on repeated inserts', () => {
    // Simulate inserting 5 footnotes one by one.
    let usedSoFar = new Set<number>();
    for (let expected = 1; expected <= 5; expected++) {
      const next = nextAvailableLabel(usedSoFar);
      expect(next).toBe(expected);
      usedSoFar = new Set([...usedSoFar, next]);
    }
  });
});
