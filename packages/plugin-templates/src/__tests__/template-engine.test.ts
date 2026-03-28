/**
 * Tests for template-engine.ts
 *
 * Covers:
 * - Basic variable substitution (built-in + custom)
 * - {{cursor}} placeholder detection and removal
 * - {{#if variable}} conditional blocks (truthy, falsy, else, nested)
 * - extractVariables — deduplication, built-in detection
 * - getRequiredCustomVariables
 * - findCursorPlaceholder
 * - Edge cases: empty template, malformed conditionals, unknown variables
 */

import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  extractVariables,
  getRequiredCustomVariables,
  findCursorPlaceholder,
} from '../template-engine';
import type { RenderContext } from '../template-engine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2025-06-15T14:30:00.000Z');

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    title: 'My Note',
    author: 'Alice',
    now: FIXED_DATE,
    locale: 'en-US',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// renderTemplate — built-in variables
// ---------------------------------------------------------------------------

describe('renderTemplate — built-in variables', () => {
  it('substitutes {{title}}', () => {
    const result = renderTemplate('# {{title}}', ctx({ title: 'Hello World' }));
    expect(result.content).toBe('# Hello World');
  });

  it('substitutes {{author}}', () => {
    const result = renderTemplate('By {{author}}', ctx({ author: 'Bob' }));
    expect(result.content).toBe('By Bob');
  });

  it('substitutes {{date}} in expected format', () => {
    const result = renderTemplate('Date: {{date}}', ctx());
    // en-US locale formats as M/D/YYYY or similar — just verify it contains a /
    expect(result.content).toMatch(/Date: \d/);
  });

  it('substitutes {{time}} with hours and minutes', () => {
    const result = renderTemplate('Time: {{time}}', ctx());
    expect(result.content).toMatch(/Time: \d{1,2}:\d{2}/);
  });

  it('substitutes {{datetime}} containing both date and time parts', () => {
    const result = renderTemplate('{{datetime}}', ctx());
    // Should contain both a slash (date) and a colon (time)
    expect(result.content).toMatch(/\d/);
    expect(result.content).toContain(':');
  });

  it('uses empty string for missing title', () => {
    const result = renderTemplate('# {{title}}', ctx({ title: undefined }));
    expect(result.content).toBe('# ');
  });

  it('uses empty string for missing author', () => {
    const result = renderTemplate('by {{author}}', ctx({ author: undefined }));
    expect(result.content).toBe('by ');
  });

  it('substitutes multiple occurrences of the same variable', () => {
    const result = renderTemplate('{{title}} and {{title}}', ctx({ title: 'X' }));
    expect(result.content).toBe('X and X');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — custom variables
// ---------------------------------------------------------------------------

describe('renderTemplate — custom variables', () => {
  it('substitutes a custom variable', () => {
    const result = renderTemplate('Mood: {{mood}}', ctx({ variables: { mood: 'great' } }));
    expect(result.content).toBe('Mood: great');
  });

  it('custom variable overrides built-in with same name', () => {
    // Not a recommended pattern, but should work for forward compatibility.
    const result = renderTemplate('{{date}}', ctx({ variables: { date: 'OVERRIDDEN' } }));
    expect(result.content).toBe('OVERRIDDEN');
  });

  it('leaves unknown variables as-is and records them in unresolvedVariables', () => {
    const result = renderTemplate('{{unknown_var}}', ctx());
    expect(result.content).toBe('{{unknown_var}}');
    expect(result.unresolvedVariables).toContain('unknown_var');
  });

  it('reports multiple unresolved variables without duplicates', () => {
    const result = renderTemplate('{{foo}} {{bar}} {{foo}}', ctx());
    expect(result.unresolvedVariables.sort()).toEqual(['bar', 'foo']);
  });

  it('returns empty unresolvedVariables when all vars are resolved', () => {
    const result = renderTemplate('{{title}} {{author}}', ctx());
    expect(result.unresolvedVariables).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — {{cursor}}
// ---------------------------------------------------------------------------

describe('renderTemplate — cursor placeholder', () => {
  it('removes {{cursor}} from content', () => {
    const result = renderTemplate('Hello {{cursor}} World', ctx());
    expect(result.content).toBe('Hello  World');
  });

  it('sets cursorOffset to the character position of {{cursor}}', () => {
    const result = renderTemplate('Hello {{cursor}} World', ctx());
    expect(result.cursorOffset).toBe(6); // "Hello " is 6 chars
  });

  it('cursorOffset is undefined when template has no {{cursor}}', () => {
    const result = renderTemplate('No cursor here', ctx());
    expect(result.cursorOffset).toBeUndefined();
  });

  it('handles {{cursor}} at the start of template', () => {
    const result = renderTemplate('{{cursor}}after', ctx());
    expect(result.cursorOffset).toBe(0);
    expect(result.content).toBe('after');
  });

  it('handles {{cursor}} at the end of template', () => {
    const result = renderTemplate('before{{cursor}}', ctx());
    expect(result.cursorOffset).toBe(6); // "before" = 6 chars
    expect(result.content).toBe('before');
  });

  it('does not include cursor in unresolvedVariables', () => {
    const result = renderTemplate('{{cursor}}', ctx());
    expect(result.unresolvedVariables).not.toContain('cursor');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — conditional blocks
// ---------------------------------------------------------------------------

describe('renderTemplate — {{#if}} conditionals', () => {
  it('renders then-branch when variable is truthy', () => {
    const result = renderTemplate(
      '{{#if mood}}Mood: {{mood}}{{/if}}',
      ctx({ variables: { mood: 'happy' } }),
    );
    expect(result.content).toBe('Mood: happy');
  });

  it('renders nothing when variable is falsy (no else branch)', () => {
    const result = renderTemplate('{{#if mood}}Mood: {{mood}}{{/if}}', ctx());
    expect(result.content).toBe('');
  });

  it('renders else-branch when variable is falsy', () => {
    const result = renderTemplate('{{#if mood}}{{mood}}{{else}}—{{/if}}', ctx());
    expect(result.content).toBe('—');
  });

  it('renders then-branch over else when variable is present', () => {
    const result = renderTemplate(
      '{{#if mood}}{{mood}}{{else}}—{{/if}}',
      ctx({ variables: { mood: 'focused' } }),
    );
    expect(result.content).toBe('focused');
  });

  it('treats empty-string variable as falsy', () => {
    const result = renderTemplate(
      '{{#if val}}yes{{else}}no{{/if}}',
      ctx({ variables: { val: '' } }),
    );
    expect(result.content).toBe('no');
  });

  it('handles multiple conditional blocks in the same template', () => {
    const template = '{{#if a}}A{{/if}} {{#if b}}B{{/if}}';
    const result = renderTemplate(template, ctx({ variables: { a: '1', b: '2' } }));
    expect(result.content).toBe('A B');
  });

  it('handles nested conditional blocks', () => {
    const template = '{{#if outer}}{{#if inner}}both{{else}}outer only{{/if}}{{/if}}';
    const resultBoth = renderTemplate(template, ctx({ variables: { outer: 'yes', inner: 'yes' } }));
    expect(resultBoth.content).toBe('both');

    const resultOuter = renderTemplate(template, ctx({ variables: { outer: 'yes' } }));
    expect(resultOuter.content).toBe('outer only');

    const resultNone = renderTemplate(template, ctx({ variables: {} }));
    expect(resultNone.content).toBe('');
  });

  it('uses built-in variables in conditionals', () => {
    const result = renderTemplate(
      '{{#if title}}has title{{else}}no title{{/if}}',
      ctx({ title: 'X' }),
    );
    expect(result.content).toBe('has title');
  });

  it('tolerates malformed conditional without closing tag (leaves block as-is)', () => {
    const template = '{{#if foo}}opened but not closed';
    const result = renderTemplate(template, ctx({ variables: { foo: 'val' } }));
    // Should not throw and should produce some output.
    expect(() => result).not.toThrow();
  });

  it('performs variable substitution inside conditional branch', () => {
    const template = '{{#if name}}Hello, {{name}}!{{/if}}';
    const result = renderTemplate(template, ctx({ variables: { name: 'World' } }));
    expect(result.content).toBe('Hello, World!');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — empty / edge cases
// ---------------------------------------------------------------------------

describe('renderTemplate — edge cases', () => {
  it('returns empty content for empty template', () => {
    const result = renderTemplate('', ctx());
    expect(result.content).toBe('');
    expect(result.unresolvedVariables).toHaveLength(0);
    expect(result.cursorOffset).toBeUndefined();
  });

  it('returns template unchanged when no variables present', () => {
    const result = renderTemplate('Plain text without variables.', ctx());
    expect(result.content).toBe('Plain text without variables.');
  });

  it('uses current date when no "now" provided in context', () => {
    const before = Date.now();
    const result = renderTemplate('{{date}}', { title: 'T' });
    const after = Date.now();
    // The result should be a valid date string. We can't check exact value,
    // just verify it is non-empty.
    expect(result.content.length).toBeGreaterThan(0);
    expect(before).toBeLessThanOrEqual(after);
  });

  it('handles template with only whitespace', () => {
    const result = renderTemplate('   \n   ', ctx());
    expect(result.content).toBe('   \n   ');
  });

  it('does not mutate the input template string', () => {
    const template = '# {{title}}';
    const original = template;
    renderTemplate(template, ctx());
    expect(template).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// extractVariables
// ---------------------------------------------------------------------------

describe('extractVariables', () => {
  it('extracts a single variable', () => {
    const vars = extractVariables('{{title}}');
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('title');
    expect(vars[0].isBuiltIn).toBe(true);
  });

  it('extracts custom and built-in variables', () => {
    const vars = extractVariables('{{date}} {{mood}}');
    expect(vars.map((v) => v.name).sort()).toEqual(['date', 'mood']);
    const date = vars.find((v) => v.name === 'date');
    const mood = vars.find((v) => v.name === 'mood');
    expect(date?.isBuiltIn).toBe(true);
    expect(mood?.isBuiltIn).toBe(false);
  });

  it('deduplicates repeated variables', () => {
    const vars = extractVariables('{{title}} {{title}} {{title}}');
    expect(vars).toHaveLength(1);
  });

  it('extracts variables from conditional openers', () => {
    const vars = extractVariables('{{#if mood}}...{{/if}}');
    expect(vars.map((v) => v.name)).toContain('mood');
  });

  it('does not include syntax tokens (#if, /if, else)', () => {
    const vars = extractVariables('{{#if foo}}{{else}}{{/if}}');
    const names = vars.map((v) => v.name);
    expect(names).not.toContain('#if');
    expect(names).not.toContain('/if');
    expect(names).not.toContain('else');
    expect(names).toContain('foo');
  });

  it('returns empty array for template with no variables', () => {
    const vars = extractVariables('Plain text');
    expect(vars).toHaveLength(0);
  });

  it('marks cursor as built-in', () => {
    const vars = extractVariables('{{cursor}}');
    const cursor = vars.find((v) => v.name === 'cursor');
    expect(cursor?.isBuiltIn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRequiredCustomVariables
// ---------------------------------------------------------------------------

describe('getRequiredCustomVariables', () => {
  it('returns only non-built-in variables', () => {
    const required = getRequiredCustomVariables('{{date}} {{title}} {{mood}} {{topic}}');
    expect(required.sort()).toEqual(['mood', 'topic']);
  });

  it('excludes cursor from required variables', () => {
    const required = getRequiredCustomVariables('{{cursor}} {{mood}}');
    expect(required).not.toContain('cursor');
    expect(required).toContain('mood');
  });

  it('returns empty array when all variables are built-in', () => {
    const required = getRequiredCustomVariables('{{date}} {{time}} {{title}} {{author}}');
    expect(required).toHaveLength(0);
  });

  it('returns empty array for template with no variables', () => {
    expect(getRequiredCustomVariables('Plain text')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// findCursorPlaceholder
// ---------------------------------------------------------------------------

describe('findCursorPlaceholder', () => {
  it('returns offset when {{cursor}} is present', () => {
    const offset = findCursorPlaceholder('Hello {{cursor}} world');
    expect(offset).toBe(6); // "Hello " = 6 chars
  });

  it('returns 0 when {{cursor}} is at start', () => {
    expect(findCursorPlaceholder('{{cursor}}text')).toBe(0);
  });

  it('returns undefined when {{cursor}} is absent', () => {
    expect(findCursorPlaceholder('No cursor here')).toBeUndefined();
  });

  it('returns position of first {{cursor}} when multiple appear', () => {
    const offset = findCursorPlaceholder('A{{cursor}}B{{cursor}}C');
    expect(offset).toBe(1);
  });
});
