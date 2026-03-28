/**
 * Tests for built-in-templates.ts
 *
 * Covers:
 * - Structure validation for all 8 built-in templates
 * - Registry lookup functions
 * - Template body content sanity checks
 * - Variable definitions
 * - Trigger syntax validation
 */

import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  getBuiltInTemplate,
  getBuiltInTemplatesByTag,
  getBuiltInTemplateByTrigger,
  validateBuiltInTemplate,
} from '../built-in-templates';
import { renderTemplate } from '../template-engine';

// ---------------------------------------------------------------------------
// Structure validation — all templates
// ---------------------------------------------------------------------------

describe('BUILT_IN_TEMPLATES — structure validation', () => {
  it('exports exactly 8 built-in templates', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(8);
  });

  it('every template passes validateBuiltInTemplate with no errors', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const errors = validateBuiltInTemplate(template);
      expect(errors, `${template.id} has errors: ${errors.join(', ')}`).toHaveLength(0);
    }
  });

  it('every template has a unique id', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every template has a non-empty name', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.meta.name.length, `${t.id} has empty name`).toBeGreaterThan(0);
    }
  });

  it('every template has a non-empty body', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.body.length, `${t.id} has empty body`).toBeGreaterThan(0);
    }
  });

  it('all ids start with "built-in:"', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.id.startsWith('built-in:'), `${t.id} does not start with built-in:`).toBe(true);
    }
  });

  it('all triggers (when present) start with "/"', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      if (t.meta.trigger) {
        expect(
          t.meta.trigger.startsWith('/'),
          `${t.id} trigger "${t.meta.trigger}" does not start with /`,
        ).toBe(true);
      }
    }
  });

  it('all triggers are unique across templates', () => {
    const triggers = BUILT_IN_TEMPLATES.map((t) => t.meta.trigger).filter(
      (t): t is string => t !== undefined,
    );
    const unique = new Set(triggers);
    expect(unique.size).toBe(triggers.length);
  });

  it('all variable names match the allowed pattern', () => {
    const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    for (const t of BUILT_IN_TEMPLATES) {
      for (const v of t.meta.variables) {
        expect(VALID_NAME.test(v.name), `${t.id} variable "${v.name}" has invalid name`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Named templates — existence checks
// ---------------------------------------------------------------------------

describe('BUILT_IN_TEMPLATES — named templates', () => {
  const templateNames = BUILT_IN_TEMPLATES.map((t) => t.meta.name);

  it('includes Blank template', () => {
    expect(templateNames).toContain('Blank');
  });

  it('includes Daily Note template', () => {
    expect(templateNames).toContain('Daily Note');
  });

  it('includes Meeting Notes template', () => {
    expect(templateNames).toContain('Meeting Notes');
  });

  it('includes Project Brief template', () => {
    expect(templateNames).toContain('Project Brief');
  });

  it('includes Book Review template', () => {
    expect(templateNames).toContain('Book Review');
  });

  it('includes Weekly Review template', () => {
    expect(templateNames).toContain('Weekly Review');
  });

  it('includes Bug Report template', () => {
    expect(templateNames).toContain('Bug Report');
  });

  it('includes Research Note template', () => {
    expect(templateNames).toContain('Research Note');
  });
});

// ---------------------------------------------------------------------------
// Template body content checks
// ---------------------------------------------------------------------------

describe('BUILT_IN_TEMPLATES — body content', () => {
  it('Blank template body contains {{title}} and {{cursor}}', () => {
    const blank = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Blank');
    expect(blank).toBeDefined();
    expect(blank!.body).toContain('{{title}}');
    expect(blank!.body).toContain('{{cursor}}');
  });

  it('Daily Note body uses {{date}} and {{author}}', () => {
    const daily = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Daily Note');
    expect(daily).toBeDefined();
    expect(daily!.body).toContain('{{date}}');
    expect(daily!.body).toContain('{{author}}');
  });

  it('Meeting Notes body has attendees and action items section', () => {
    const meeting = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Meeting Notes');
    expect(meeting).toBeDefined();
    expect(meeting!.body.toLowerCase()).toContain('action item');
    expect(meeting!.body).toContain('{{attendees}}');
  });

  it('Project Brief body has goals section', () => {
    const project = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Project Brief');
    expect(project).toBeDefined();
    expect(project!.body).toContain('Goals');
  });

  it('Bug Report body has steps to reproduce section', () => {
    const bug = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Bug Report');
    expect(bug).toBeDefined();
    expect(bug!.body).toContain('Steps to Reproduce');
  });

  it('Weekly Review body has priority/focus section', () => {
    const weekly = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Weekly Review');
    expect(weekly).toBeDefined();
    expect(weekly!.body.toLowerCase()).toContain('priorit');
  });

  it('Book Review body has key takeaways section', () => {
    const book = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Book Review');
    expect(book).toBeDefined();
    expect(book!.body).toContain('Key Takeaways');
  });

  it('Research Note body has conclusions section', () => {
    const research = BUILT_IN_TEMPLATES.find((t) => t.meta.name === 'Research Note');
    expect(research).toBeDefined();
    expect(research!.body).toContain('Conclusions');
  });
});

// ---------------------------------------------------------------------------
// renderTemplate — built-in templates render without errors
// ---------------------------------------------------------------------------

describe('BUILT_IN_TEMPLATES — render sanity', () => {
  const BASE_CTX = {
    title: 'Test Note',
    author: 'Tester',
    now: new Date('2025-06-15T12:00:00Z'),
    locale: 'en-US',
    variables: {
      mood: 'good',
      week_number: 'W24',
      attendees: 'Alice, Bob',
      location: 'Zoom',
      status: 'Active',
      owner: 'Alice',
      deadline: '2025-12-31',
      author_name: 'Test Author',
      genre: 'Non-fiction',
      rating: '5',
      date_read: '2025-06-15',
      severity: 'Medium',
      component: 'Auth',
      version: '1.0.0',
      topic: 'Testing',
      hypothesis: 'Hypothesis',
    },
  };

  for (const template of BUILT_IN_TEMPLATES) {
    it(`${template.meta.name} renders without throwing`, () => {
      expect(() => renderTemplate(template.body, BASE_CTX)).not.toThrow();
    });

    it(`${template.meta.name} renders to non-empty content`, () => {
      const result = renderTemplate(template.body, BASE_CTX);
      expect(result.content.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// getBuiltInTemplate
// ---------------------------------------------------------------------------

describe('getBuiltInTemplate', () => {
  it('returns the template for a valid id', () => {
    const t = getBuiltInTemplate('built-in:blank');
    expect(t).toBeDefined();
    expect(t!.meta.name).toBe('Blank');
  });

  it('returns undefined for an unknown id', () => {
    const t = getBuiltInTemplate('built-in:nonexistent');
    expect(t).toBeUndefined();
  });

  it('returns undefined for user template id format', () => {
    const t = getBuiltInTemplate('user:my-template');
    expect(t).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getBuiltInTemplatesByTag
// ---------------------------------------------------------------------------

describe('getBuiltInTemplatesByTag', () => {
  it('returns templates matching the given tag', () => {
    const results = getBuiltInTemplatesByTag('journal');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((t) => t.meta.tags.includes('journal'))).toBe(true);
  });

  it('returns empty array for unknown tag', () => {
    const results = getBuiltInTemplatesByTag('nonexistent-tag-xyz');
    expect(results).toHaveLength(0);
  });

  it('returns multiple templates when several share a tag', () => {
    // Both Daily Note and Weekly Review have "productivity" tag.
    const results = getBuiltInTemplatesByTag('productivity');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// getBuiltInTemplateByTrigger
// ---------------------------------------------------------------------------

describe('getBuiltInTemplateByTrigger', () => {
  it('returns the Daily Note template for "/daily" trigger', () => {
    const t = getBuiltInTemplateByTrigger('/daily');
    expect(t).toBeDefined();
    expect(t!.meta.name).toBe('Daily Note');
  });

  it('returns the Meeting Notes template for "/meeting" trigger', () => {
    const t = getBuiltInTemplateByTrigger('/meeting');
    expect(t).toBeDefined();
    expect(t!.meta.name).toBe('Meeting Notes');
  });

  it('returns undefined for unknown trigger', () => {
    const t = getBuiltInTemplateByTrigger('/unknown-trigger-xyz');
    expect(t).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const t = getBuiltInTemplateByTrigger('/Daily');
    expect(t).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateBuiltInTemplate — error cases
// ---------------------------------------------------------------------------

describe('validateBuiltInTemplate — error reporting', () => {
  it('reports error when id does not start with "built-in:"', () => {
    const errors = validateBuiltInTemplate({
      id: 'user:bad-id',
      meta: { name: 'Test', description: '', variables: [], tags: [] },
      body: 'body',
    });
    expect(errors.some((e) => e.includes('built-in:'))).toBe(true);
  });

  it('reports error when name is empty', () => {
    const errors = validateBuiltInTemplate({
      id: 'built-in:test',
      meta: { name: '', description: '', variables: [], tags: [] },
      body: 'body',
    });
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('reports error when body is empty', () => {
    const errors = validateBuiltInTemplate({
      id: 'built-in:test',
      meta: { name: 'Test', description: '', variables: [], tags: [] },
      body: '',
    });
    expect(errors.some((e) => e.includes('body'))).toBe(true);
  });

  it('reports error when trigger does not start with "/"', () => {
    const errors = validateBuiltInTemplate({
      id: 'built-in:test',
      meta: { name: 'Test', description: '', variables: [], tags: [], trigger: 'bad-trigger' },
      body: 'body',
    });
    expect(errors.some((e) => e.includes('trigger'))).toBe(true);
  });

  it('reports error when variable name contains invalid characters', () => {
    const errors = validateBuiltInTemplate({
      id: 'built-in:test',
      meta: {
        name: 'Test',
        description: '',
        variables: [{ name: 'bad name!', description: '', default: '' }],
        tags: [],
      },
      body: 'body',
    });
    expect(errors.some((e) => e.includes('variable name'))).toBe(true);
  });

  it('returns empty errors for a valid template', () => {
    const errors = validateBuiltInTemplate({
      id: 'built-in:valid',
      meta: {
        name: 'Valid',
        description: 'ok',
        variables: [{ name: 'my_var', description: '', default: '' }],
        tags: ['test'],
        trigger: '/valid',
      },
      body: 'body content',
    });
    expect(errors).toHaveLength(0);
  });
});
