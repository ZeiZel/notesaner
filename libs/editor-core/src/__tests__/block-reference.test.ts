/**
 * Unit tests for the BlockReference TipTap extension.
 *
 * Strategy:
 *   - Test all pure logic functions independently (no DOM, no editor instance).
 *   - ID generation, regex matching, reference building, and validation are
 *     covered with direct unit tests.
 *   - Extension integration (commands, clipboard) is covered via a headless
 *     TipTap editor instance.
 *
 * Coverage targets:
 *   lines: 80% / branches: 70% / functions: 80%
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import {
  BlockReference,
  generateBlockId,
  extractBlockRefId,
  buildReferenceString,
  buildBlockRefSuffix,
  hasBlockRef,
  isValidBlockRefId,
  collectBlockRefIds,
  generateUniqueBlockId,
  BLOCK_REF_REGEX,
  BLOCK_REF_ID_REGEX,
} from '../extensions/block-reference';

// ---------------------------------------------------------------------------
// Helper: build a lightweight ProseMirror-compatible doc stub
// ---------------------------------------------------------------------------

interface StubNode {
  typeName: string;
  textContent: string;
  isBlock: boolean;
}

function makeDocStub(nodes: StubNode[]): import('@tiptap/pm/model').Node {
  return {
    descendants(
      cb: (
        node: { type: { name: string }; textContent: string; isBlock: boolean },
        pos: number,
      ) => void,
    ) {
      nodes.forEach((n, i) =>
        cb({ type: { name: n.typeName }, textContent: n.textContent, isBlock: n.isBlock }, i),
      );
    },
  } as unknown as import('@tiptap/pm/model').Node;
}

// ===========================================================================
// 1. BLOCK_REF_REGEX
// ===========================================================================

describe('BLOCK_REF_REGEX', () => {
  function match(input: string) {
    return BLOCK_REF_REGEX.exec(input);
  }

  // ---- Happy path ----------------------------------------------------------

  it('matches a simple alphanumeric block ref " ^abc123"', () => {
    const m = match('Some text ^abc123');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('abc123');
  });

  it('matches a single-char block ref " ^a"', () => {
    const m = match('Text ^a');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a');
  });

  it('matches a hyphenated block ref " ^my-ref-id"', () => {
    const m = match('Content ^my-ref-id');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('my-ref-id');
  });

  it('matches block ref with trailing whitespace', () => {
    const m = match('Text ^abc123 ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('abc123');
  });

  it('matches block ref at end of longer text', () => {
    const m = match('This is a paragraph with some text ^x1y2z3');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x1y2z3');
  });

  // ---- Non-matching cases --------------------------------------------------

  it('does not match without leading space before ^', () => {
    const m = match('text^abc123');
    expect(m).toBeNull();
  });

  it('does not match ^ in the middle of text without being at the end', () => {
    const m = match('^abc123 some more text');
    expect(m).toBeNull();
  });

  it('does not match an empty ref " ^"', () => {
    const m = match('Text ^');
    expect(m).toBeNull();
  });

  // ---- Edge cases ----------------------------------------------------------

  it('captures only the last ^ref when multiple exist', () => {
    const m = match('Text ^first ^second');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('second');
  });
});

// ===========================================================================
// 2. BLOCK_REF_ID_REGEX
// ===========================================================================

describe('BLOCK_REF_ID_REGEX', () => {
  it('matches simple alphanumeric IDs', () => {
    expect(BLOCK_REF_ID_REGEX.test('abc123')).toBe(true);
    expect(BLOCK_REF_ID_REGEX.test('a')).toBe(true);
    expect(BLOCK_REF_ID_REGEX.test('1')).toBe(true);
  });

  it('matches hyphenated IDs', () => {
    expect(BLOCK_REF_ID_REGEX.test('my-ref')).toBe(true);
    expect(BLOCK_REF_ID_REGEX.test('a-b-c')).toBe(true);
  });

  it('rejects IDs starting or ending with hyphen', () => {
    expect(BLOCK_REF_ID_REGEX.test('-abc')).toBe(false);
    expect(BLOCK_REF_ID_REGEX.test('abc-')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(BLOCK_REF_ID_REGEX.test('')).toBe(false);
  });

  it('rejects IDs with special characters', () => {
    expect(BLOCK_REF_ID_REGEX.test('abc@123')).toBe(false);
    expect(BLOCK_REF_ID_REGEX.test('abc 123')).toBe(false);
    expect(BLOCK_REF_ID_REGEX.test('abc.123')).toBe(false);
  });
});

// ===========================================================================
// 3. generateBlockId
// ===========================================================================

describe('generateBlockId', () => {
  it('generates an ID of the requested length', () => {
    expect(generateBlockId(6)).toHaveLength(6);
    expect(generateBlockId(8)).toHaveLength(8);
    expect(generateBlockId(4)).toHaveLength(4);
  });

  it('clamps length to minimum of 4', () => {
    expect(generateBlockId(1)).toHaveLength(4);
    expect(generateBlockId(0)).toHaveLength(4);
  });

  it('clamps length to maximum of 12', () => {
    expect(generateBlockId(20)).toHaveLength(12);
    expect(generateBlockId(100)).toHaveLength(12);
  });

  it('produces only alphanumeric characters', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateBlockId(6);
      expect(id).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('generates different IDs on successive calls (probabilistic)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(generateBlockId(6));
    }
    // With 36^6 possibilities, 50 IDs should all be unique.
    expect(ids.size).toBe(50);
  });

  it('uses default length of 6', () => {
    expect(generateBlockId()).toHaveLength(6);
  });
});

// ===========================================================================
// 4. extractBlockRefId
// ===========================================================================

describe('extractBlockRefId', () => {
  it('extracts ID from text with a block ref', () => {
    expect(extractBlockRefId('Some text ^abc123')).toBe('abc123');
  });

  it('returns null for text without a block ref', () => {
    expect(extractBlockRefId('Just plain text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractBlockRefId('')).toBeNull();
  });

  it('extracts hyphenated IDs', () => {
    expect(extractBlockRefId('Text ^my-ref-id')).toBe('my-ref-id');
  });

  it('extracts the last ref when multiple exist', () => {
    expect(extractBlockRefId('Text ^first ^second')).toBe('second');
  });

  it('handles trailing whitespace', () => {
    expect(extractBlockRefId('Text ^abc123  ')).toBe('abc123');
  });
});

// ===========================================================================
// 5. buildReferenceString
// ===========================================================================

describe('buildReferenceString', () => {
  it('builds full reference with note title', () => {
    expect(buildReferenceString('My Note', 'abc123')).toBe('[[My Note#^abc123]]');
  });

  it('builds local reference without note title', () => {
    expect(buildReferenceString(null, 'abc123')).toBe('#^abc123');
  });

  it('handles note titles with special characters', () => {
    expect(buildReferenceString('Note/Path (2)', 'ref1')).toBe('[[Note/Path (2)#^ref1]]');
  });

  it('handles empty string note title as truthy (still wraps)', () => {
    // Empty string is falsy in JS, so it should produce local reference.
    expect(buildReferenceString('', 'abc')).toBe('#^abc');
  });
});

// ===========================================================================
// 6. buildBlockRefSuffix
// ===========================================================================

describe('buildBlockRefSuffix', () => {
  it('builds correct suffix', () => {
    expect(buildBlockRefSuffix('abc123')).toBe(' ^abc123');
  });

  it('always starts with space and caret', () => {
    const suffix = buildBlockRefSuffix('xyz');
    expect(suffix.startsWith(' ^')).toBe(true);
  });

  it('preserves the ID exactly', () => {
    expect(buildBlockRefSuffix('my-ref-id')).toBe(' ^my-ref-id');
  });
});

// ===========================================================================
// 7. isValidBlockRefId
// ===========================================================================

describe('isValidBlockRefId', () => {
  it('validates simple alphanumeric IDs', () => {
    expect(isValidBlockRefId('abc123')).toBe(true);
    expect(isValidBlockRefId('a')).toBe(true);
    expect(isValidBlockRefId('1')).toBe(true);
  });

  it('validates hyphenated IDs', () => {
    expect(isValidBlockRefId('my-ref')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidBlockRefId('')).toBe(false);
  });

  it('rejects IDs longer than 12 characters', () => {
    expect(isValidBlockRefId('a'.repeat(13))).toBe(false);
  });

  it('rejects IDs starting with hyphen', () => {
    expect(isValidBlockRefId('-abc')).toBe(false);
  });
});

// ===========================================================================
// 8. hasBlockRef
// ===========================================================================

describe('hasBlockRef', () => {
  it('returns true for node with block ref', () => {
    const node = { textContent: 'Some text ^abc123' } as import('@tiptap/pm/model').Node;
    expect(hasBlockRef(node)).toBe(true);
  });

  it('returns false for node without block ref', () => {
    const node = { textContent: 'Just plain text' } as import('@tiptap/pm/model').Node;
    expect(hasBlockRef(node)).toBe(false);
  });

  it('returns false for empty node', () => {
    const node = { textContent: '' } as import('@tiptap/pm/model').Node;
    expect(hasBlockRef(node)).toBe(false);
  });
});

// ===========================================================================
// 9. collectBlockRefIds
// ===========================================================================

describe('collectBlockRefIds', () => {
  it('returns empty set for document without block refs', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', textContent: 'No refs here', isBlock: true },
    ]);
    expect(collectBlockRefIds(doc).size).toBe(0);
  });

  it('collects single block ref ID', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', textContent: 'Text ^abc123', isBlock: true },
    ]);
    const ids = collectBlockRefIds(doc);
    expect(ids.size).toBe(1);
    expect(ids.has('abc123')).toBe(true);
  });

  it('collects multiple block ref IDs', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', textContent: 'First ^ref1', isBlock: true },
      { typeName: 'paragraph', textContent: 'Second ^ref2', isBlock: true },
      { typeName: 'heading', textContent: 'Heading ^ref3', isBlock: true },
    ]);
    const ids = collectBlockRefIds(doc);
    expect(ids.size).toBe(3);
    expect(ids.has('ref1')).toBe(true);
    expect(ids.has('ref2')).toBe(true);
    expect(ids.has('ref3')).toBe(true);
  });

  it('ignores non-block nodes', () => {
    const doc = makeDocStub([
      { typeName: 'text', textContent: 'Inline ^ref1', isBlock: false },
      { typeName: 'paragraph', textContent: 'Block ^ref2', isBlock: true },
    ]);
    const ids = collectBlockRefIds(doc);
    expect(ids.size).toBe(1);
    expect(ids.has('ref2')).toBe(true);
  });

  it('ignores blocks without text content', () => {
    const doc = makeDocStub([
      { typeName: 'paragraph', textContent: '', isBlock: true },
      { typeName: 'paragraph', textContent: 'Has ref ^abc', isBlock: true },
    ]);
    const ids = collectBlockRefIds(doc);
    expect(ids.size).toBe(1);
  });
});

// ===========================================================================
// 10. generateUniqueBlockId
// ===========================================================================

describe('generateUniqueBlockId', () => {
  it('generates ID not in the existing set', () => {
    const existing = new Set(['abc123', 'def456']);
    const id = generateUniqueBlockId(existing, 6);
    expect(existing.has(id)).toBe(false);
    expect(id).toHaveLength(6);
  });

  it('works with empty existing set', () => {
    const id = generateUniqueBlockId(new Set(), 6);
    expect(id).toHaveLength(6);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('falls back to longer ID when maxAttempts exhausted', () => {
    // Create a mock where all 6-char IDs collide.
    // We test the fallback by using a maxAttempts of 0.
    const id = generateUniqueBlockId(new Set(), 6, 0);
    // Should fall back to length 8 (6+2, clamped to max 12)
    expect(id.length).toBe(8);
  });
});

// ===========================================================================
// 11. BlockReference extension — registration
// ===========================================================================

describe('BlockReference extension — registration', () => {
  let editor: Editor;

  beforeEach(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    editor = new Editor({
      element: container,
      extensions: [StarterKit, BlockReference],
      content: '<p>Hello world</p><p>Second paragraph</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    document.body.innerHTML = '';
  });

  it('registers the createBlockReference command', () => {
    expect(typeof editor.commands.createBlockReference).toBe('function');
  });

  it('registers the removeBlockReference command', () => {
    expect(typeof editor.commands.removeBlockReference).toBe('function');
  });
});

// ===========================================================================
// 12. BlockReference extension — createBlockReference command
// ===========================================================================

describe('BlockReference extension — createBlockReference command', () => {
  let editor: Editor;
  let clipboardContent: string;

  beforeEach(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    clipboardContent = '';

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        BlockReference.configure({
          noteTitle: 'Test Note',
          writeToClipboard: async (text: string) => {
            clipboardContent = text;
          },
        }),
      ],
      content: '<p>Hello world</p><p>Second paragraph</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    document.body.innerHTML = '';
  });

  it('appends a block reference to the block at cursor', () => {
    // Place cursor inside the first paragraph.
    editor.commands.setTextSelection(1);

    const result = editor.commands.createBlockReference();
    expect(result).toBe(true);

    // The first paragraph should now contain a ^ref suffix.
    const firstParagraph = editor.state.doc.firstChild;
    expect(firstParagraph).not.toBeNull();
    expect(firstParagraph!.textContent).toMatch(/\^[a-z0-9]+$/);
  });

  it('copies the reference string to clipboard', async () => {
    editor.commands.setTextSelection(1);
    editor.commands.createBlockReference();

    // Allow async clipboard write to complete.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(clipboardContent).toMatch(/^\[\[Test Note#\^[a-z0-9]+\]\]$/);
  });

  it('reuses existing block ref ID when one already exists', () => {
    // Manually set content with an existing block ref.
    editor.commands.setContent('<p>Existing text ^myref1</p>');
    editor.commands.setTextSelection(1);

    const result = editor.commands.createBlockReference();
    expect(result).toBe(true);

    // Content should NOT have a second ^ref appended.
    const text = editor.state.doc.firstChild!.textContent;
    const matches = text.match(/\^/g);
    // Only one ^ should exist (the original).
    expect(matches).toHaveLength(1);
  });

  it('allows note title override via command options', async () => {
    editor.commands.setTextSelection(1);
    editor.commands.createBlockReference({ noteTitle: 'Override Note' });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(clipboardContent).toMatch(/^\[\[Override Note#\^[a-z0-9]+\]\]$/);
  });

  it('produces local reference when no note title is set', async () => {
    const container2 = document.createElement('div');
    document.body.appendChild(container2);

    let localClipboard = '';
    const localEditor = new Editor({
      element: container2,
      extensions: [
        StarterKit,
        BlockReference.configure({
          writeToClipboard: async (text: string) => {
            localClipboard = text;
          },
        }),
      ],
      content: '<p>No title note</p>',
    });

    localEditor.commands.setTextSelection(1);
    localEditor.commands.createBlockReference();

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(localClipboard).toMatch(/^#\^[a-z0-9]+$/);
    localEditor.destroy();
  });
});

// ===========================================================================
// 13. BlockReference extension — removeBlockReference command
// ===========================================================================

describe('BlockReference extension — removeBlockReference command', () => {
  let editor: Editor;

  beforeEach(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        BlockReference.configure({
          writeToClipboard: async () => {},
        }),
      ],
      content: '<p>Text with ref ^abc123</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
    document.body.innerHTML = '';
  });

  it('removes the block reference suffix from the block', () => {
    editor.commands.setTextSelection(1);

    const result = editor.commands.removeBlockReference();
    expect(result).toBe(true);

    const text = editor.state.doc.firstChild!.textContent;
    expect(text).not.toContain('^');
    expect(text).toBe('Text with ref');
  });

  it('returns false when block has no reference', () => {
    editor.commands.setContent('<p>No reference here</p>');
    editor.commands.setTextSelection(1);

    const result = editor.commands.removeBlockReference();
    expect(result).toBe(false);
  });
});

// ===========================================================================
// 14. BlockReference extension — configure options
// ===========================================================================

describe('BlockReference extension — configure options', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
    document.body.innerHTML = '';
  });

  it('accepts custom idLength option', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        BlockReference.configure({
          idLength: 8,
          writeToClipboard: async () => {},
        }),
      ],
      content: '<p>Test content</p>',
    });

    editor.commands.setTextSelection(1);
    editor.commands.createBlockReference();

    const text = editor.state.doc.firstChild!.textContent;
    // Extract the ^id part.
    const refMatch = text.match(/\^([a-z0-9]+)$/);
    expect(refMatch).not.toBeNull();
    expect(refMatch![1]).toHaveLength(8);
  });

  it('uses default options when none are provided', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      editor = new Editor({
        element: container,
        extensions: [StarterKit, BlockReference],
        content: '<p>Test</p>',
      });
    }).not.toThrow();
  });
});

// ===========================================================================
// 15. Markdown round-trip
// ===========================================================================

describe('Markdown round-trip: reference string ↔ BLOCK_REF_REGEX', () => {
  it('buildBlockRefSuffix output is parseable by BLOCK_REF_REGEX', () => {
    const suffix = buildBlockRefSuffix('abc123');
    const text = `Some text${suffix}`;
    const m = BLOCK_REF_REGEX.exec(text);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('abc123');
  });

  it('extractBlockRefId can parse output of buildBlockRefSuffix', () => {
    const id = 'xy12z9';
    const text = `Paragraph content${buildBlockRefSuffix(id)}`;
    expect(extractBlockRefId(text)).toBe(id);
  });

  it('buildReferenceString produces valid Obsidian reference syntax', () => {
    const ref = buildReferenceString('My Note', 'abc123');
    // Should match [[title#^id]] pattern
    expect(ref).toMatch(/^\[\[.+#\^[a-zA-Z0-9-]+\]\]$/);
  });
});
