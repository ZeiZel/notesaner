/**
 * Unit tests for the mermaid-extension.ts feature-layer module.
 *
 * Tests cover:
 * - createMermaidExtension: returns a configured extension object
 * - insertMermaidBlock: delegates to editor.chain() and returns boolean
 * - hasMermaidExtension: extension presence guard
 * - MERMAID_TOOLBAR_ITEMS: shape and completeness
 * - Re-exported pure utilities: getMermaidStarter, detectDiagramType
 *
 * resolveMermaidTheme DOM tests are covered in libs/editor-core/__tests__/mermaid.test.ts.
 * Mermaid render and NodeView tests are in Playwright integration tests.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  insertMermaidBlock,
  hasMermaidExtension,
  MERMAID_TOOLBAR_ITEMS,
  getMermaidStarter,
  detectDiagramType,
  MERMAID_DIAGRAM_TYPES,
  createMermaidExtension,
} from '../lib/mermaid-extension';
import type { MermaidDiagramType } from '../lib/mermaid-extension';

// ---------------------------------------------------------------------------
// Helpers: mock TipTap Editor
// ---------------------------------------------------------------------------

function makeRunMock(returns = true) {
  return vi.fn(() => returns);
}

function makeMockEditor(
  options: {
    hasExtension?: boolean;
    isEditable?: boolean;
    chainReturns?: boolean;
  } = {},
) {
  const { hasExtension = true, isEditable = true, chainReturns = true } = options;

  const runMock = makeRunMock(chainReturns);
  const insertMermaidBlockMock = vi.fn(() => ({ run: runMock }));
  const focusMock = vi.fn(() => ({ insertMermaidBlock: insertMermaidBlockMock }));
  const chainMock = vi.fn(() => ({ focus: focusMock }));

  const extensions = hasExtension ? [{ name: 'mermaidBlock' }, { name: 'doc' }] : [{ name: 'doc' }];

  return {
    isEditable,
    extensionManager: { extensions },
    chain: chainMock,
    _mocks: { chainMock, focusMock, insertMermaidBlockMock, runMock },
  };
}

// ---------------------------------------------------------------------------
// createMermaidExtension
// ---------------------------------------------------------------------------

describe('createMermaidExtension', () => {
  it('returns an object (TipTap extension)', () => {
    const ext = createMermaidExtension();
    expect(ext).toBeDefined();
    expect(typeof ext).toBe('object');
  });

  it('has the name "mermaidBlock"', () => {
    const ext = createMermaidExtension();
    // TipTap extensions expose name as a property
    expect((ext as { name?: string }).name).toBe('mermaidBlock');
  });

  it('accepts option overrides without throwing', () => {
    expect(() =>
      createMermaidExtension({ defaultTheme: 'dark', renderDebounceMs: 500 }),
    ).not.toThrow();
  });

  it('accepts empty options without throwing', () => {
    expect(() => createMermaidExtension({})).not.toThrow();
  });

  it('uses dark theme override correctly', () => {
    const ext = createMermaidExtension({ defaultTheme: 'dark' });
    expect(ext).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// insertMermaidBlock
// ---------------------------------------------------------------------------

describe('insertMermaidBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls editor.chain().focus().insertMermaidBlock() and returns true', () => {
    const editor = makeMockEditor();
    const result = insertMermaidBlock(editor as never, 'flowchart');

    expect(result).toBe(true);
    expect(editor._mocks.chainMock).toHaveBeenCalledOnce();
    expect(editor._mocks.focusMock).toHaveBeenCalledOnce();
    expect(editor._mocks.insertMermaidBlockMock).toHaveBeenCalledWith({
      diagramType: 'flowchart',
      content: undefined,
    });
    expect(editor._mocks.runMock).toHaveBeenCalledOnce();
  });

  it('passes content override when provided', () => {
    const editor = makeMockEditor();
    const customCode = 'graph LR\n    A --> B';
    insertMermaidBlock(editor as never, 'graph', customCode);

    expect(editor._mocks.insertMermaidBlockMock).toHaveBeenCalledWith({
      diagramType: 'graph',
      content: customCode,
    });
  });

  it('works without diagramType or content (uses defaults)', () => {
    const editor = makeMockEditor();
    const result = insertMermaidBlock(editor as never);

    expect(result).toBe(true);
    expect(editor._mocks.insertMermaidBlockMock).toHaveBeenCalledWith({
      diagramType: undefined,
      content: undefined,
    });
  });

  it('returns false when the chain command returns false', () => {
    const editor = makeMockEditor({ chainReturns: false });
    const result = insertMermaidBlock(editor as never, 'pie');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasMermaidExtension
// ---------------------------------------------------------------------------

describe('hasMermaidExtension', () => {
  it('returns true when the mermaidBlock extension is registered', () => {
    const editor = makeMockEditor({ hasExtension: true });
    expect(hasMermaidExtension(editor as never)).toBe(true);
  });

  it('returns false when the mermaidBlock extension is not registered', () => {
    const editor = makeMockEditor({ hasExtension: false });
    expect(hasMermaidExtension(editor as never)).toBe(false);
  });

  it('returns false when editor is null', () => {
    expect(hasMermaidExtension(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MERMAID_TOOLBAR_ITEMS
// ---------------------------------------------------------------------------

describe('MERMAID_TOOLBAR_ITEMS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MERMAID_TOOLBAR_ITEMS)).toBe(true);
    expect(MERMAID_TOOLBAR_ITEMS.length).toBeGreaterThan(0);
  });

  it('every item has required fields: label, diagramType, description', () => {
    for (const item of MERMAID_TOOLBAR_ITEMS) {
      expect(typeof item.label).toBe('string');
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(typeof item.diagramType).toBe('string');
      expect(item.diagramType.trim().length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('every diagramType appears in MERMAID_DIAGRAM_TYPES', () => {
    // Use Array.includes instead of Set.has to avoid readonly tuple issues
    const validTypes = MERMAID_DIAGRAM_TYPES as readonly string[];
    for (const item of MERMAID_TOOLBAR_ITEMS) {
      expect(
        validTypes.includes(item.diagramType),
        `"${item.diagramType}" is not in MERMAID_DIAGRAM_TYPES`,
      ).toBe(true);
    }
  });

  it('contains the most common diagram types', () => {
    const types = MERMAID_TOOLBAR_ITEMS.map((i) => i.diagramType);
    const required: MermaidDiagramType[] = [
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
      'gantt',
      'pie',
    ];
    for (const type of required) {
      expect(types, `Expected "${type}" in MERMAID_TOOLBAR_ITEMS`).toContain(type);
    }
  });

  it('has no duplicate diagramType entries', () => {
    const types = MERMAID_TOOLBAR_ITEMS.map((i) => i.diagramType);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });
});

// ---------------------------------------------------------------------------
// getMermaidStarter (re-export from editor-core)
// ---------------------------------------------------------------------------

describe('getMermaidStarter (re-export)', () => {
  it('returns a non-empty flowchart template by default', () => {
    const starter = getMermaidStarter();
    expect(typeof starter).toBe('string');
    expect(starter.trim().length).toBeGreaterThan(0);
    expect(starter).toContain('flowchart');
  });

  it('returns a starter for each toolbar item diagram type', () => {
    for (const item of MERMAID_TOOLBAR_ITEMS) {
      const starter = getMermaidStarter(item.diagramType);
      expect(typeof starter, `Starter for "${item.diagramType}" should be a string`).toBe('string');
      expect(
        starter.trim().length,
        `Starter for "${item.diagramType}" should not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('returns flowchart as default for unknown diagram types', () => {
    const starter = getMermaidStarter('unknownDiagramType');
    expect(starter).toContain('flowchart');
  });
});

// ---------------------------------------------------------------------------
// detectDiagramType (re-export from editor-core)
// ---------------------------------------------------------------------------

describe('detectDiagramType (re-export)', () => {
  it('detects flowchart', () => {
    expect(detectDiagramType('flowchart TD\n    A --> B')).toBe('flowchart');
  });

  it('detects sequenceDiagram', () => {
    expect(detectDiagramType('sequenceDiagram\n    Alice->>Bob: Hi')).toBe('sequenceDiagram');
  });

  it('detects classDiagram', () => {
    expect(detectDiagramType('classDiagram\n    class Foo')).toBe('classDiagram');
  });

  it('detects gantt', () => {
    expect(detectDiagramType('gantt\n    title Gantt')).toBe('gantt');
  });

  it('detects pie', () => {
    expect(detectDiagramType('pie\n    "A" : 50')).toBe('pie');
  });

  it('skips leading blank lines', () => {
    expect(detectDiagramType('\n\n  sequenceDiagram\n    Alice->>Bob: Hi')).toBe('sequenceDiagram');
  });

  it('returns null for empty string', () => {
    expect(detectDiagramType('')).toBeNull();
  });

  it('returns null for unknown keywords', () => {
    expect(detectDiagramType('unknownDiagramType\n    ...')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(detectDiagramType('FLOWCHART LR\n    A --> B')).toBe('flowchart');
  });
});

// ---------------------------------------------------------------------------
// MERMAID_DIAGRAM_TYPES (re-export from editor-core)
// ---------------------------------------------------------------------------

describe('MERMAID_DIAGRAM_TYPES (re-export)', () => {
  it('is a non-empty readonly array', () => {
    expect(MERMAID_DIAGRAM_TYPES.length).toBeGreaterThan(0);
  });

  it('includes all toolbar item types', () => {
    const validTypes = MERMAID_DIAGRAM_TYPES as readonly string[];
    for (const item of MERMAID_TOOLBAR_ITEMS) {
      expect(validTypes.includes(item.diagramType)).toBe(true);
    }
  });

  it('has no duplicate entries', () => {
    const asArray = MERMAID_DIAGRAM_TYPES as readonly string[];
    const unique = new Set(asArray);
    expect(unique.size).toBe(asArray.length);
  });
});
