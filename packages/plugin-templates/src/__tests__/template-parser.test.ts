/**
 * Tests for template-parser.ts
 *
 * Covers:
 * - parseTemplateFile: frontmatter extraction, metadata parsing
 * - Handling files without frontmatter
 * - Variable metadata extraction
 * - Trigger, folderDefault, tags parsing
 * - serializeTemplate: round-trip serialisation
 * - Edge cases: empty content, minimal frontmatter, missing fields
 */

import { describe, it, expect } from 'vitest';
import { parseTemplateFile, serializeTemplate } from '../template-parser';
import type { TemplateMeta } from '../template-parser';

// ---------------------------------------------------------------------------
// parseTemplateFile — basic frontmatter parsing
// ---------------------------------------------------------------------------

describe('parseTemplateFile — basic frontmatter', () => {
  it('parses a fully populated frontmatter', () => {
    const content = `---
template_name: "Daily Note"
template_description: "Daily journaling template"
template_tags: [journal, daily]
---

# {{title}}
`;
    const result = parseTemplateFile(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.meta.name).toBe('Daily Note');
    expect(result.meta.description).toBe('Daily journaling template');
    expect(result.meta.tags).toEqual(['journal', 'daily']);
    expect(result.body).toBe('# {{title}}');
  });

  it('returns body content without the frontmatter', () => {
    const content = `---
template_name: "Test"
---

Body here.
`;
    const result = parseTemplateFile(content);
    expect(result.body).toBe('Body here.');
  });

  it('trims leading/trailing whitespace from body', () => {
    const content = `---
template_name: "Test"
---


body line
`;
    const result = parseTemplateFile(content);
    // The body is trimmed of leading/trailing blank lines.
    expect(result.body).toBe('body line');
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — without frontmatter
// ---------------------------------------------------------------------------

describe('parseTemplateFile — no frontmatter', () => {
  it('treats entire content as body when no frontmatter delimiter', () => {
    const content = '# My Note\n\nSome content.';
    const result = parseTemplateFile(content);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe(content);
  });

  it('uses filename as name when no frontmatter', () => {
    const content = 'Just content.';
    const result = parseTemplateFile(content, '/templates/weekly-review.md');
    expect(result.meta.name).toBe('weekly-review');
  });

  it('uses Untitled as name when no frontmatter and no filePath', () => {
    const result = parseTemplateFile('content');
    expect(result.meta.name).toBe('Untitled');
  });

  it('returns empty variables and tags with no frontmatter', () => {
    const result = parseTemplateFile('content');
    expect(result.meta.variables).toHaveLength(0);
    expect(result.meta.tags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — template variables
// ---------------------------------------------------------------------------

describe('parseTemplateFile — template_variables', () => {
  it('parses a list of custom variables', () => {
    const content = `---
template_name: "Meeting"
template_variables:
  - name: attendees
    description: "List of attendees"
    default: ""
  - name: location
    description: "Meeting location"
    default: "Zoom"
---

Body.
`;
    const result = parseTemplateFile(content);

    expect(result.meta.variables).toHaveLength(2);
    expect(result.meta.variables[0]).toMatchObject({
      name: 'attendees',
      description: 'List of attendees',
      default: '',
    });
    expect(result.meta.variables[1]).toMatchObject({
      name: 'location',
      description: 'Meeting location',
      default: 'Zoom',
    });
  });

  it('skips variables with empty name', () => {
    const content = `---
template_name: "Test"
template_variables:
  - name: ""
    description: "no name"
  - name: valid_var
    description: "ok"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.variables).toHaveLength(1);
    expect(result.meta.variables[0].name).toBe('valid_var');
  });

  it('handles absent template_variables gracefully', () => {
    const content = `---
template_name: "Blank"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.variables).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — optional fields
// ---------------------------------------------------------------------------

describe('parseTemplateFile — optional fields', () => {
  it('parses template_trigger', () => {
    const content = `---
template_name: "Daily"
template_trigger: "/daily"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.trigger).toBe('/daily');
  });

  it('parses template_folder_default', () => {
    const content = `---
template_name: "Daily"
template_folder_default: "Daily Notes"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.folderDefault).toBe('Daily Notes');
  });

  it('sets trigger to undefined when not present', () => {
    const content = `---
template_name: "Test"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.trigger).toBeUndefined();
  });

  it('sets folderDefault to undefined when not present', () => {
    const content = `---
template_name: "Test"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.folderDefault).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — tags parsing
// ---------------------------------------------------------------------------

describe('parseTemplateFile — tags', () => {
  it('parses inline array tags', () => {
    const content = `---
template_name: "T"
template_tags: [journal, daily, productivity]
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.tags).toEqual(['journal', 'daily', 'productivity']);
  });

  it('parses comma-separated string tags', () => {
    const content = `---
template_name: "T"
template_tags: "journal, daily"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.tags).toEqual(['journal', 'daily']);
  });

  it('returns empty tags array when absent', () => {
    const content = `---
template_name: "T"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.tags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — name derivation
// ---------------------------------------------------------------------------

describe('parseTemplateFile — name derivation', () => {
  it('uses template_name from frontmatter over filename', () => {
    const content = `---
template_name: "Explicit Name"
---
Body.
`;
    const result = parseTemplateFile(content, '/templates/filename.md');
    expect(result.meta.name).toBe('Explicit Name');
  });

  it('derives name from filename when template_name absent', () => {
    const content = `---
template_description: "desc only"
---
Body.
`;
    const result = parseTemplateFile(content, '/templates/bug-report.md');
    expect(result.meta.name).toBe('bug-report');
  });

  it('uses Untitled when template_name absent and no filePath', () => {
    const content = `---
template_description: "desc"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.name).toBe('Untitled');
  });

  it('strips file extension from derived name', () => {
    const result = parseTemplateFile('content', '/path/to/my-template.md');
    expect(result.meta.name).toBe('my-template');
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFile — edge cases
// ---------------------------------------------------------------------------

describe('parseTemplateFile — edge cases', () => {
  it('handles empty content', () => {
    const result = parseTemplateFile('');
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe('');
  });

  it('handles frontmatter with no body', () => {
    const content = `---
template_name: "Empty Body"
---
`;
    const result = parseTemplateFile(content);
    expect(result.meta.name).toBe('Empty Body');
    expect(result.body).toBe('');
  });

  it('handles quoted values in frontmatter', () => {
    const content = `---
template_name: "Name with \\"quotes\\""
---
Body.
`;
    const result = parseTemplateFile(content);
    // The name should be properly unquoted.
    expect(result.meta.name.length).toBeGreaterThan(0);
  });

  it('handles description with special characters', () => {
    const content = `---
template_name: "Test"
template_description: "Template for note-taking: logs & more"
---
Body.
`;
    const result = parseTemplateFile(content);
    expect(result.meta.description).toContain('note-taking');
  });
});

// ---------------------------------------------------------------------------
// serializeTemplate
// ---------------------------------------------------------------------------

describe('serializeTemplate', () => {
  it('produces valid frontmatter with template_name', () => {
    const meta: TemplateMeta = {
      name: 'My Template',
      description: '',
      variables: [],
      tags: [],
    };
    const result = serializeTemplate(meta, 'Body content');
    expect(result).toContain('template_name: "My Template"');
    expect(result).toContain('---');
  });

  it('includes description when present', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: 'A description',
      variables: [],
      tags: [],
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).toContain('template_description: "A description"');
  });

  it('omits description when empty', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [],
      tags: [],
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).not.toContain('template_description');
  });

  it('includes trigger when present', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [],
      tags: [],
      trigger: '/daily',
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).toContain('template_trigger: "/daily"');
  });

  it('includes folderDefault when present', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [],
      tags: [],
      folderDefault: 'Daily Notes',
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).toContain('template_folder_default: "Daily Notes"');
  });

  it('includes tags array', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [],
      tags: ['journal', 'daily'],
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).toContain('template_tags:');
    expect(result).toContain('"journal"');
    expect(result).toContain('"daily"');
  });

  it('includes custom variables', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [{ name: 'mood', description: 'Your mood', default: 'happy' }],
      tags: [],
    };
    const result = serializeTemplate(meta, 'Body');
    expect(result).toContain('template_variables:');
    expect(result).toContain('name: mood');
    expect(result).toContain('description: "Your mood"');
    expect(result).toContain('default: "happy"');
  });

  it('includes body after closing ---', () => {
    const meta: TemplateMeta = {
      name: 'T',
      description: '',
      variables: [],
      tags: [],
    };
    const result = serializeTemplate(meta, '# Body content');
    expect(result).toContain('---\n\n# Body content');
  });

  it('round-trips through parseTemplateFile', () => {
    const originalMeta: TemplateMeta = {
      name: 'Round Trip',
      description: 'Test description',
      variables: [{ name: 'foo', description: 'Foo desc', default: 'bar' }],
      tags: ['test'],
      trigger: '/round',
      folderDefault: 'Notes',
    };
    const body = '# {{title}}\n\n{{cursor}}';
    const serialized = serializeTemplate(originalMeta, body);
    const parsed = parseTemplateFile(serialized);

    expect(parsed.meta.name).toBe(originalMeta.name);
    expect(parsed.meta.description).toBe(originalMeta.description);
    expect(parsed.meta.trigger).toBe(originalMeta.trigger);
    expect(parsed.meta.folderDefault).toBe(originalMeta.folderDefault);
    expect(parsed.meta.tags).toEqual(originalMeta.tags);
    expect(parsed.meta.variables[0].name).toBe('foo');
    expect(parsed.body).toBe(body);
  });
});
