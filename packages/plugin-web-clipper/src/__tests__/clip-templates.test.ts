/**
 * Tests for clip-templates.ts
 *
 * Covers:
 * - renderTemplate: simple placeholder substitution
 * - renderTemplate: conditional blocks ({{#key}} / {{/key}})
 * - renderTemplate: {{tagList}} rendering
 * - renderTemplate: missing context values default to empty string
 * - getDefaultTemplate: mode-to-template mapping
 * - titleToFilename: slug generation
 * - All four built-in templates render without errors
 * - Templates produce valid frontmatter structure
 */

import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  getDefaultTemplate,
  titleToFilename,
  TEMPLATE_ARTICLE,
  TEMPLATE_BOOKMARK,
  TEMPLATE_HIGHLIGHT,
  TEMPLATE_SCREENSHOT,
  DEFAULT_TEMPLATES,
} from '../clip-templates';
import type { TemplateContext } from '../clip-templates';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONTEXT: TemplateContext = {
  title: 'How Yjs Works',
  url: 'https://example.com/yjs-article',
  author: 'Alice Smith',
  date: '2025-06-15',
  clippedAt: '2026-03-28T12:00:00.000Z',
  siteName: 'Tech Blog',
  content: '## Introduction\n\nYjs is a CRDT framework.',
  selection: 'Yjs is a CRDT framework.',
  description: 'A deep dive into Yjs internals.',
  tags: ['yjs', 'crdt', 'collaboration'],
  screenshot: '![Screenshot](data:image/png;base64,abc)',
};

// ---------------------------------------------------------------------------
// renderTemplate — basic substitution
// ---------------------------------------------------------------------------

describe('renderTemplate — basic substitution', () => {
  it('replaces {{title}} with context title', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('How Yjs Works');
  });

  it('replaces {{url}} with context url', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('https://example.com/yjs-article');
  });

  it('replaces {{author}} with context author', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('Alice Smith');
  });

  it('replaces {{date}} with context date', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('2025-06-15');
  });

  it('replaces {{clippedAt}} with context clippedAt', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('2026-03-28T12:00:00.000Z');
  });

  it('replaces {{siteName}} with context siteName', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('Tech Blog');
  });

  it('replaces {{content}} with context content', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('## Introduction');
    expect(result).toContain('Yjs is a CRDT framework.');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — tag list
// ---------------------------------------------------------------------------

describe('renderTemplate — tagList', () => {
  it('renders tags as quoted comma-separated list', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('"yjs"');
    expect(result).toContain('"crdt"');
    expect(result).toContain('"collaboration"');
  });

  it('renders empty string when tags array is empty', () => {
    const ctx = { ...BASE_CONTEXT, tags: [] };
    const result = renderTemplate(TEMPLATE_ARTICLE, ctx);
    // tagList should be empty — no quoted strings in the tags: [] line
    expect(result).toContain('tags: []');
  });

  it('handles undefined tags gracefully', () => {
    const ctx: TemplateContext = { ...BASE_CONTEXT, tags: undefined };
    expect(() => renderTemplate(TEMPLATE_ARTICLE, ctx)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — conditional blocks
// ---------------------------------------------------------------------------

describe('renderTemplate — conditional blocks', () => {
  it('renders {{#author}} block when author is set', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('**Author**');
  });

  it('hides {{#author}} block when author is absent', () => {
    const ctx: TemplateContext = { ...BASE_CONTEXT, author: undefined };
    const result = renderTemplate(TEMPLATE_ARTICLE, ctx);
    expect(result).not.toContain('**Author**');
  });

  it('renders {{#date}} block when date is set', () => {
    const result = renderTemplate(TEMPLATE_ARTICLE, BASE_CONTEXT);
    expect(result).toContain('**Published**');
  });

  it('hides {{#date}} block when date is absent', () => {
    const ctx: TemplateContext = { ...BASE_CONTEXT, date: undefined };
    const result = renderTemplate(TEMPLATE_ARTICLE, ctx);
    expect(result).not.toContain('**Published**');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — missing context values
// ---------------------------------------------------------------------------

describe('renderTemplate — missing values', () => {
  it('replaces missing placeholder with empty string', () => {
    const minimalCtx: TemplateContext = {
      title: 'Test',
      url: 'https://example.com',
      clippedAt: '2026-01-01T00:00:00Z',
    };
    const result = renderTemplate(TEMPLATE_BOOKMARK, minimalCtx);
    // Should render without leaving {{placeholder}} in output
    expect(result).not.toMatch(/\{\{[^}]+\}\}/);
  });
});

// ---------------------------------------------------------------------------
// TEMPLATE_BOOKMARK
// ---------------------------------------------------------------------------

describe('TEMPLATE_BOOKMARK', () => {
  it('renders title and URL', () => {
    const result = renderTemplate(TEMPLATE_BOOKMARK, BASE_CONTEXT);
    expect(result).toContain('How Yjs Works');
    expect(result).toContain('https://example.com/yjs-article');
  });

  it('includes description when provided', () => {
    const result = renderTemplate(TEMPLATE_BOOKMARK, BASE_CONTEXT);
    expect(result).toContain('A deep dive into Yjs internals.');
  });

  it('produces YAML frontmatter with type: bookmark', () => {
    const result = renderTemplate(TEMPLATE_BOOKMARK, BASE_CONTEXT);
    expect(result).toContain('type: bookmark');
  });
});

// ---------------------------------------------------------------------------
// TEMPLATE_HIGHLIGHT
// ---------------------------------------------------------------------------

describe('TEMPLATE_HIGHLIGHT', () => {
  it('renders selection as blockquote', () => {
    const result = renderTemplate(TEMPLATE_HIGHLIGHT, BASE_CONTEXT);
    expect(result).toContain('> Yjs is a CRDT framework.');
  });

  it('includes source attribution link', () => {
    const result = renderTemplate(TEMPLATE_HIGHLIGHT, BASE_CONTEXT);
    expect(result).toContain('[How Yjs Works](https://example.com/yjs-article)');
  });

  it('produces YAML frontmatter with type: highlight', () => {
    const result = renderTemplate(TEMPLATE_HIGHLIGHT, BASE_CONTEXT);
    expect(result).toContain('type: highlight');
  });
});

// ---------------------------------------------------------------------------
// TEMPLATE_SCREENSHOT
// ---------------------------------------------------------------------------

describe('TEMPLATE_SCREENSHOT', () => {
  it('renders screenshot embed', () => {
    const result = renderTemplate(TEMPLATE_SCREENSHOT, BASE_CONTEXT);
    expect(result).toContain('![Screenshot]');
  });

  it('includes source link', () => {
    const result = renderTemplate(TEMPLATE_SCREENSHOT, BASE_CONTEXT);
    expect(result).toContain('https://example.com/yjs-article');
  });

  it('produces YAML frontmatter with type: screenshot', () => {
    const result = renderTemplate(TEMPLATE_SCREENSHOT, BASE_CONTEXT);
    expect(result).toContain('type: screenshot');
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_TEMPLATES registry
// ---------------------------------------------------------------------------

describe('DEFAULT_TEMPLATES', () => {
  it('contains all four built-in templates', () => {
    expect(DEFAULT_TEMPLATES['article']).toBeDefined();
    expect(DEFAULT_TEMPLATES['bookmark']).toBeDefined();
    expect(DEFAULT_TEMPLATES['highlight']).toBeDefined();
    expect(DEFAULT_TEMPLATES['screenshot']).toBeDefined();
  });

  it('each template has id, name, description, and body', () => {
    for (const tpl of Object.values(DEFAULT_TEMPLATES)) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.body).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// getDefaultTemplate
// ---------------------------------------------------------------------------

describe('getDefaultTemplate', () => {
  it('returns TEMPLATE_ARTICLE for mode=article', () => {
    expect(getDefaultTemplate('article').id).toBe('article');
  });

  it('returns TEMPLATE_ARTICLE for mode=full', () => {
    expect(getDefaultTemplate('full').id).toBe('article');
  });

  it('returns TEMPLATE_HIGHLIGHT for mode=selection', () => {
    expect(getDefaultTemplate('selection').id).toBe('highlight');
  });

  it('returns TEMPLATE_SCREENSHOT for mode=screenshot', () => {
    expect(getDefaultTemplate('screenshot').id).toBe('screenshot');
  });
});

// ---------------------------------------------------------------------------
// titleToFilename
// ---------------------------------------------------------------------------

describe('titleToFilename', () => {
  it('lowercases the title', () => {
    expect(titleToFilename('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(titleToFilename('a b c')).toBe('a-b-c');
  });

  it('replaces special characters with hyphens and collapses runs', () => {
    // "C# & .NET: A Guide!" -> lower: "c# & .net: a guide!"
    // non-alnum replaced with "-" and consecutive hyphens collapsed
    const result = titleToFilename('C# & .NET: A Guide!');
    expect(result).toMatch(/^c-.*net.*a.*guide$/);
    // No double-hyphens (they're collapsed)
    expect(result).not.toContain('--');
  });

  it('collapses multiple hyphens', () => {
    expect(titleToFilename('Hello   World')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(titleToFilename('---hello---')).toBe('hello');
  });

  it('truncates at 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(titleToFilename(long).length).toBeLessThanOrEqual(80);
  });

  it('returns untitled-clip for empty/whitespace title', () => {
    expect(titleToFilename('')).toBe('untitled-clip');
    expect(titleToFilename('   ')).toBe('untitled-clip');
  });

  it('handles unicode by stripping non-alphanumeric', () => {
    expect(titleToFilename('Héllo Wörld')).toBe('h-llo-w-rld');
  });
});
