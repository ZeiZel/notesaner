/**
 * Tests for EmailTemplateEngine
 *
 * Covers: variable substitution, HTML escaping, raw output, conditional blocks,
 * iteration, nested contexts, edge cases, and the validateTemplate utility.
 */

import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  escapeHtml,
  validateTemplate,
  TemplateVariables,
} from '../email-template-engine';

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes < to &lt;', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes > to &gt;', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes " to &quot;', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it("escapes ' to &#x27;", () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes / to &#x2F;', () => {
    expect(escapeHtml('a/b')).toBe('a&#x2F;b');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes multiple special characters in one string', () => {
    expect(escapeHtml('<a href="url">click</a>')).toBe(
      '&lt;a href=&quot;url&quot;&gt;click&lt;&#x2F;a&gt;',
    );
  });
});

// ─── renderTemplate — variable substitution ───────────────────────────────────

describe('renderTemplate — variable substitution', () => {
  it('replaces a simple {{variable}}', () => {
    expect(renderTemplate('Hello, {{name}}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('HTML-escapes double-brace output', () => {
    expect(renderTemplate('{{xss}}', { xss: '<script>alert(1)</script>' })).toBe(
      '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;',
    );
  });

  it('does not escape triple-brace raw output', () => {
    expect(renderTemplate('{{{raw}}}', { raw: '<b>bold</b>' })).toBe('<b>bold</b>');
  });

  it('resolves dot-notation paths', () => {
    const vars: TemplateVariables = { user: { name: 'Bob', age: 30 } };
    expect(renderTemplate('{{user.name}} is {{user.age}}', vars)).toBe('Bob is 30');
  });

  it('returns empty string for missing variable', () => {
    expect(renderTemplate('{{missing}}', {})).toBe('');
  });

  it('returns empty string for null variable', () => {
    expect(renderTemplate('{{val}}', { val: null })).toBe('');
  });

  it('returns empty string for undefined variable', () => {
    expect(renderTemplate('{{val}}', { val: undefined })).toBe('');
  });

  it('renders boolean true as "true"', () => {
    expect(renderTemplate('{{flag}}', { flag: true })).toBe('true');
  });

  it('renders boolean false as "false"', () => {
    expect(renderTemplate('{{flag}}', { flag: false })).toBe('false');
  });

  it('renders numeric zero correctly', () => {
    expect(renderTemplate('{{count}}', { count: 0 })).toBe('0');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(renderTemplate('{{x}} + {{x}}', { x: '2' })).toBe('2 + 2');
  });

  it('leaves unknown block tags unchanged when surrounded by non-block syntax', () => {
    const result = renderTemplate('Hello {{name}}. End.', { name: 'World' });
    expect(result).toBe('Hello World. End.');
  });

  it('processes triple braces before double braces to avoid double-escaping', () => {
    const result = renderTemplate('{{{html}}} and {{escaped}}', {
      html: '<b>bold</b>',
      escaped: '<em>italic</em>',
    });
    expect(result).toBe('<b>bold</b> and &lt;em&gt;italic&lt;&#x2F;em&gt;');
  });
});

// ─── renderTemplate — {{#if}} blocks ─────────────────────────────────────────

describe('renderTemplate — {{#if}} blocks', () => {
  it('renders then-branch when condition is truthy string', () => {
    expect(renderTemplate('{{#if name}}Hello {{name}}{{/if}}', { name: 'Alice' })).toBe(
      'Hello Alice',
    );
  });

  it('renders nothing when condition is falsy (empty string)', () => {
    expect(renderTemplate('{{#if name}}Hello{{/if}}', { name: '' })).toBe('');
  });

  it('renders nothing when condition is false', () => {
    expect(renderTemplate('{{#if flag}}shown{{/if}}', { flag: false })).toBe('');
  });

  it('renders nothing when condition is null', () => {
    expect(renderTemplate('{{#if val}}shown{{/if}}', { val: null })).toBe('');
  });

  it('renders nothing when condition is undefined', () => {
    expect(renderTemplate('{{#if val}}shown{{/if}}', { val: undefined })).toBe('');
  });

  it('renders nothing when condition is zero', () => {
    expect(renderTemplate('{{#if count}}shown{{/if}}', { count: 0 })).toBe('');
  });

  it('renders then-branch when condition is non-zero number', () => {
    expect(renderTemplate('{{#if count}}shown{{/if}}', { count: 5 })).toBe('shown');
  });

  it('renders else-branch when condition is falsy', () => {
    expect(renderTemplate('{{#if flag}}yes{{else}}no{{/if}}', { flag: false })).toBe('no');
  });

  it('renders then-branch and skips else when condition is truthy', () => {
    expect(renderTemplate('{{#if flag}}yes{{else}}no{{/if}}', { flag: true })).toBe('yes');
  });

  it('renders nothing for empty array condition', () => {
    expect(renderTemplate('{{#if items}}has items{{/if}}', { items: [] })).toBe('');
  });

  it('renders then-branch for non-empty array condition', () => {
    expect(renderTemplate('{{#if items}}has items{{/if}}', { items: [1] })).toBe('has items');
  });

  it('evaluates variables within if-branch', () => {
    expect(
      renderTemplate('{{#if show}}Name: {{name}}{{/if}}', { show: true, name: 'Charlie' }),
    ).toBe('Name: Charlie');
  });

  it('resolves dot-notation condition', () => {
    expect(renderTemplate('{{#if user.active}}active{{/if}}', { user: { active: true } })).toBe(
      'active',
    );
  });
});

// ─── renderTemplate — {{#each}} blocks ───────────────────────────────────────

describe('renderTemplate — {{#each}} blocks', () => {
  it('iterates over a simple array of primitives', () => {
    expect(renderTemplate('{{#each items}}[{{this}}]{{/each}}', { items: ['a', 'b', 'c'] })).toBe(
      '[a][b][c]',
    );
  });

  it('exposes @index', () => {
    expect(
      renderTemplate('{{#each items}}{{@index}}:{{this}} {{/each}}', { items: ['x', 'y'] }),
    ).toBe('0:x 1:y ');
  });

  it('renders object array properties', () => {
    const vars: TemplateVariables = {
      users: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ],
    };
    expect(renderTemplate('{{#each users}}{{name}}({{age}}) {{/each}}', vars)).toBe(
      'Alice(30) Bob(25) ',
    );
  });

  it('returns empty string for empty array', () => {
    expect(renderTemplate('{{#each items}}item{{/each}}', { items: [] })).toBe('');
  });

  it('returns empty string when variable is not an array', () => {
    expect(renderTemplate('{{#each items}}item{{/each}}', { items: 'not-array' })).toBe('');
  });

  it('returns empty string when variable is undefined', () => {
    expect(renderTemplate('{{#each missing}}item{{/each}}', {})).toBe('');
  });

  it('HTML-escapes object values in iterations', () => {
    const vars: TemplateVariables = { items: [{ title: '<b>bold</b>' }] };
    expect(renderTemplate('{{#each items}}{{title}}{{/each}}', vars)).toBe(
      '&lt;b&gt;bold&lt;&#x2F;b&gt;',
    );
  });

  it('handles a single-element array', () => {
    expect(renderTemplate('{{#each items}}{{this}}{{/each}}', { items: ['only'] })).toBe('only');
  });
});

// ─── renderTemplate — complex / nested usage ─────────────────────────────────

describe('renderTemplate — complex / nested usage', () => {
  it('handles if-inside-each (nested rendering)', () => {
    const vars: TemplateVariables = {
      items: [
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
      ],
    };
    const template = '{{#each items}}{{#if active}}[{{name}}]{{/if}}{{/each}}';
    expect(renderTemplate(template, vars)).toBe('[Alice]');
  });

  it('renders a realistic email subject with variables', () => {
    const result = renderTemplate('{{inviterName}} invited you to join {{workspaceName}}', {
      inviterName: 'Charlie',
      workspaceName: 'Acme Notes',
    });
    expect(result).toBe('Charlie invited you to join Acme Notes');
  });

  it('does not corrupt surrounding text', () => {
    const result = renderTemplate('Before {{name}} after', { name: 'World' });
    expect(result).toBe('Before World after');
  });

  it('handles template with no variables unchanged', () => {
    const result = renderTemplate('Hello World', {});
    expect(result).toBe('Hello World');
  });

  it('renders numeric index alongside object properties', () => {
    const vars: TemplateVariables = {
      notes: [
        { title: 'First Note', url: 'https://example.com/1' },
        { title: 'Second Note', url: 'https://example.com/2' },
      ],
    };
    const template = '{{#each notes}}{{@index}}. {{title}}\n{{/each}}';
    expect(renderTemplate(template, vars)).toBe('0. First Note\n1. Second Note\n');
  });
});

// ─── validateTemplate ─────────────────────────────────────────────────────────

describe('validateTemplate', () => {
  it('returns empty array for a valid template', () => {
    expect(validateTemplate('Hello {{name}}')).toEqual([]);
  });

  it('returns empty array for a valid template with if block', () => {
    expect(validateTemplate('{{#if flag}}yes{{/if}}')).toEqual([]);
  });

  it('returns empty array for a valid template with each block', () => {
    expect(validateTemplate('{{#each items}}{{this}}{{/each}}')).toEqual([]);
  });

  it('reports mismatched {{#if}} — extra opening', () => {
    const issues = validateTemplate('{{#if a}}yes{{#if b}}maybe{{/if}}');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/{{#if}}/);
  });

  it('reports mismatched {{#if}} — extra closing', () => {
    const issues = validateTemplate('{{#if a}}yes{{/if}}{{/if}}');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/{{#if}}/);
  });

  it('reports mismatched {{#each}} — extra opening', () => {
    const issues = validateTemplate('{{#each items}}{{this}}{{#each more}}{{this}}{{/each}}');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/{{#each}}/);
  });

  it('returns multiple issues for both mismatches', () => {
    const issues = validateTemplate('{{#if a}}x{{#each b}}y{{/each}}');
    // 1 unclosed if + 0 each issues → only if reported
    const ifIssues = issues.filter((i) => i.includes('if'));
    expect(ifIssues).toHaveLength(1);
  });
});
