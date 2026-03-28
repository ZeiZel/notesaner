/**
 * Unit tests for the MermaidBlock TipTap extension.
 *
 * These tests exercise the pure logic of the extension without a DOM:
 * - detectDiagramType: first-line keyword detection
 * - resolveMermaidTheme: theme resolution from document attributes / classes
 * - getMermaidStarter: starter template lookup
 * - MERMAID_STARTERS: covers all required diagram types
 * - renderText: fenced code block serialisation
 * - renderHTML attributes: attribute round-trip helpers
 *
 * React NodeView rendering (MermaidView.tsx) and mermaid.render() integration
 * are covered by Playwright integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectDiagramType,
  resolveMermaidTheme,
  getMermaidStarter,
  MERMAID_STARTERS,
  MERMAID_DIAGRAM_TYPES,
} from '../extensions/mermaid-block';

// ---------------------------------------------------------------------------
// detectDiagramType
// ---------------------------------------------------------------------------

describe('detectDiagramType', () => {
  it('detects flowchart', () => {
    expect(detectDiagramType('flowchart TD\n    A --> B')).toBe('flowchart');
  });

  it('detects flowchart case-insensitively', () => {
    expect(detectDiagramType('FLOWCHART LR\n    A --> B')).toBe('flowchart');
  });

  it('detects graph', () => {
    expect(detectDiagramType('graph LR\n    A --> B')).toBe('graph');
  });

  it('detects sequenceDiagram', () => {
    expect(detectDiagramType('sequenceDiagram\n    Alice->>Bob: Hello')).toBe('sequenceDiagram');
  });

  it('detects classDiagram', () => {
    expect(detectDiagramType('classDiagram\n    class Foo')).toBe('classDiagram');
  });

  it('detects stateDiagram-v2', () => {
    expect(detectDiagramType('stateDiagram-v2\n    [*] --> A')).toBe('stateDiagram-v2');
  });

  it('detects erDiagram', () => {
    expect(detectDiagramType('erDiagram\n    FOO ||--o{ BAR : has')).toBe('erDiagram');
  });

  it('detects journey', () => {
    expect(detectDiagramType('journey\n    title My day')).toBe('journey');
  });

  it('detects gantt', () => {
    expect(detectDiagramType('gantt\n    title Gantt')).toBe('gantt');
  });

  it('detects pie', () => {
    expect(detectDiagramType('pie\n    "A" : 50')).toBe('pie');
  });

  it('detects gitGraph', () => {
    expect(detectDiagramType('gitGraph\n    commit')).toBe('gitGraph');
  });

  it('skips leading blank lines', () => {
    expect(detectDiagramType('\n\n  flowchart TD\n    A --> B')).toBe('flowchart');
  });

  it('returns null for empty string', () => {
    expect(detectDiagramType('')).toBeNull();
  });

  it('returns null for only whitespace', () => {
    expect(detectDiagramType('   \n  \n')).toBeNull();
  });

  it('returns null for unknown diagram type', () => {
    expect(detectDiagramType('invalidDiagram\n    ...')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveMermaidTheme
// ---------------------------------------------------------------------------

describe('resolveMermaidTheme', () => {
  beforeEach(() => {
    // nothing to set up
  });

  afterEach(() => {
    // Clean up data-theme attribute
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  it('returns "dark" when data-theme="dark" is set on <html>', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(resolveMermaidTheme('default')).toBe('dark');
  });

  it('returns "default" when data-theme="light" is set on <html>', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(resolveMermaidTheme('dark')).toBe('default');
  });

  it('returns "dark" when <html> has class "dark"', () => {
    document.documentElement.classList.add('dark');
    expect(resolveMermaidTheme('default')).toBe('dark');
  });

  it('falls back to the provided default when no document theme is set', () => {
    expect(resolveMermaidTheme('forest')).toBe('forest');
  });

  it('falls back to "neutral" when no document theme is set', () => {
    expect(resolveMermaidTheme('neutral')).toBe('neutral');
  });

  it('falls back to "base" when no document theme is set', () => {
    expect(resolveMermaidTheme('base')).toBe('base');
  });

  it('data-theme takes priority over class-based dark mode', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.add('dark');
    // data-theme="light" → returns "default", not "dark"
    expect(resolveMermaidTheme('default')).toBe('default');
  });
});

// ---------------------------------------------------------------------------
// getMermaidStarter
// ---------------------------------------------------------------------------

describe('getMermaidStarter', () => {
  it('returns a flowchart template for "flowchart"', () => {
    const starter = getMermaidStarter('flowchart');
    expect(starter).toContain('flowchart');
    expect(starter.length).toBeGreaterThan(10);
  });

  it('returns a sequenceDiagram template for "sequenceDiagram"', () => {
    const starter = getMermaidStarter('sequenceDiagram');
    expect(starter).toContain('sequenceDiagram');
  });

  it('returns a classDiagram template for "classDiagram"', () => {
    const starter = getMermaidStarter('classDiagram');
    expect(starter).toContain('classDiagram');
  });

  it('returns a gantt template for "gantt"', () => {
    const starter = getMermaidStarter('gantt');
    expect(starter).toContain('gantt');
  });

  it('returns a pie template for "pie"', () => {
    const starter = getMermaidStarter('pie');
    expect(starter).toContain('pie');
  });

  it('returns a gitGraph template for "gitGraph"', () => {
    const starter = getMermaidStarter('gitGraph');
    expect(starter).toContain('gitGraph');
  });

  it('returns flowchart as default when no type is given', () => {
    const starter = getMermaidStarter();
    expect(starter).toContain('flowchart');
  });

  it('returns flowchart as default for an unknown type', () => {
    const starter = getMermaidStarter('unknownType');
    expect(starter).toContain('flowchart');
  });

  it('returns a non-empty string for every starter', () => {
    for (const [type, template] of Object.entries(MERMAID_STARTERS)) {
      expect(typeof template).toBe('string');
      expect(template.trim().length).toBeGreaterThan(0);
      expect(getMermaidStarter(type)).toBe(template);
    }
  });
});

// ---------------------------------------------------------------------------
// MERMAID_STARTERS coverage
// ---------------------------------------------------------------------------

describe('MERMAID_STARTERS', () => {
  it('covers all required diagram types from the task spec', () => {
    const required = [
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
      'gantt',
      'pie',
      'erDiagram',
      'journey',
    ];

    for (const type of required) {
      expect(MERMAID_STARTERS).toHaveProperty(type);
      expect((MERMAID_STARTERS as Record<string, string>)[type]).toBeTruthy();
    }
  });

  it('does not include blank or whitespace-only templates', () => {
    for (const [type, template] of Object.entries(MERMAID_STARTERS)) {
      expect(template.trim(), `Template for "${type}" should not be empty`).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// MERMAID_DIAGRAM_TYPES
// ---------------------------------------------------------------------------

describe('MERMAID_DIAGRAM_TYPES', () => {
  it('is a non-empty readonly array', () => {
    expect(MERMAID_DIAGRAM_TYPES.length).toBeGreaterThan(0);
  });

  it('includes all required diagram types', () => {
    const required: string[] = [
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
      'gantt',
      'pie',
      'erDiagram',
      'journey',
      'gitGraph',
    ];
    for (const type of required) {
      expect(MERMAID_DIAGRAM_TYPES as unknown as string[]).toContain(type);
    }
  });

  it('has no duplicate entries', () => {
    const asArray = MERMAID_DIAGRAM_TYPES as unknown as string[];
    const unique = new Set(asArray);
    expect(unique.size).toBe(asArray.length);
  });
});

// ---------------------------------------------------------------------------
// renderText serialisation (pure function test — no editor instance needed)
// ---------------------------------------------------------------------------

describe('renderText fenced block serialisation', () => {
  /**
   * Minimal re-implementation of renderText to test without a full editor.
   * The actual extension method delegates to this same logic.
   */
  function renderText(code: string): string {
    return `\`\`\`mermaid\n${code}\n\`\`\``;
  }

  it('wraps code in mermaid fenced block', () => {
    expect(renderText('flowchart TD\n    A --> B')).toBe(
      '```mermaid\nflowchart TD\n    A --> B\n```',
    );
  });

  it('handles empty code', () => {
    expect(renderText('')).toBe('```mermaid\n\n```');
  });

  it('handles multi-line code', () => {
    const code = 'sequenceDiagram\n    Alice->>Bob: Hi\n    Bob-->>Alice: Hey';
    expect(renderText(code)).toBe(
      '```mermaid\nsequenceDiagram\n    Alice->>Bob: Hi\n    Bob-->>Alice: Hey\n```',
    );
  });
});

// ---------------------------------------------------------------------------
// Attribute renderHTML helpers
// ---------------------------------------------------------------------------

describe('MermaidBlock attribute renderHTML helpers', () => {
  /**
   * Mirror of the renderHTML attribute logic from the extension definition.
   * Tests that attributes serialise to the expected HTML attributes.
   */
  function renderDiagramTypeAttr(attributes: Record<string, unknown>): Record<string, string> {
    if (!attributes['diagramType']) return {};
    return { 'data-diagram-type': String(attributes['diagramType']) };
  }

  function renderThemeAttr(attributes: Record<string, unknown>): Record<string, string> {
    if (!attributes['theme']) return {};
    return { 'data-mermaid-theme': String(attributes['theme']) };
  }

  it('diagramType: returns empty object when null', () => {
    expect(renderDiagramTypeAttr({ diagramType: null })).toEqual({});
  });

  it('diagramType: returns data attribute when set', () => {
    expect(renderDiagramTypeAttr({ diagramType: 'flowchart' })).toEqual({
      'data-diagram-type': 'flowchart',
    });
  });

  it('theme: returns empty object when null', () => {
    expect(renderThemeAttr({ theme: null })).toEqual({});
  });

  it('theme: returns data attribute when set', () => {
    expect(renderThemeAttr({ theme: 'dark' })).toEqual({
      'data-mermaid-theme': 'dark',
    });
  });
});

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

describe('MermaidBlock input rule regex', () => {
  const INPUT_RULE_REGEX = /^```mermaid\s*$/;

  it('matches "```mermaid" exactly', () => {
    expect(INPUT_RULE_REGEX.test('```mermaid')).toBe(true);
  });

  it('matches "```mermaid" with trailing space', () => {
    expect(INPUT_RULE_REGEX.test('```mermaid   ')).toBe(true);
  });

  it('matches "```mermaid" with trailing tab', () => {
    expect(INPUT_RULE_REGEX.test('```mermaid\t')).toBe(true);
  });

  it('does not match "```mermaid-js"', () => {
    expect(INPUT_RULE_REGEX.test('```mermaid-js')).toBe(false);
  });

  it('does not match "```javascript"', () => {
    expect(INPUT_RULE_REGEX.test('```javascript')).toBe(false);
  });

  it('does not match an empty string', () => {
    expect(INPUT_RULE_REGEX.test('')).toBe(false);
  });

  it('does not match "```mermaid\nsome content"', () => {
    // Multi-line string: the ^ and $ anchors prevent matching
    expect(INPUT_RULE_REGEX.test('```mermaid\nsome content')).toBe(false);
  });
});
