/**
 * Built-in template definitions.
 *
 * Each entry defines a template that ships with the plugin out of the box.
 * Built-in templates cannot be deleted (only user-created templates can be
 * deleted), but they can be overridden by a template with the same name in
 * the user's templates folder.
 *
 * Templates use the standard {{variable}} syntax and may include:
 * - Built-in variables: {{date}}, {{time}}, {{datetime}}, {{title}}, {{author}}
 * - The {{cursor}} placeholder to position the editor cursor after insertion.
 * - {{#if variable}}...{{/if}} conditional blocks.
 */

import type { TemplateMeta } from './template-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A built-in template definition. */
export interface BuiltInTemplate {
  /** Unique identifier for the built-in template. */
  id: string;
  /** Template metadata. */
  meta: TemplateMeta;
  /** Template body content (without frontmatter). */
  body: string;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

/** Blank template — minimal starting point. */
const BLANK: BuiltInTemplate = {
  id: 'built-in:blank',
  meta: {
    name: 'Blank',
    description: 'Empty note with just a title heading.',
    variables: [],
    tags: ['general'],
  },
  body: '# {{title}}\n\n{{cursor}}',
};

/** Daily note — structured journaling template. */
const DAILY_NOTE: BuiltInTemplate = {
  id: 'built-in:daily-note',
  meta: {
    name: 'Daily Note',
    description: 'Daily journaling template with tasks, wins, and reflections.',
    variables: [
      {
        name: 'mood',
        description: 'How are you feeling today? (e.g. energised, tired, focused)',
        default: '',
      },
    ],
    folderDefault: 'Daily Notes',
    trigger: '/daily',
    tags: ['journal', 'daily', 'productivity'],
  },
  body: `# {{date}} — Daily Note

**Mood:** {{#if mood}}{{mood}}{{else}}—{{/if}}
**Author:** {{author}}

---

## Morning Intentions

- [ ] {{cursor}}

## Tasks

- [ ]

## Evening Reflection

### What went well today?


### What could have gone better?


### Gratitude


---
*Created at {{time}} on {{datetime}}*
`,
};

/** Meeting notes — structured meeting record. */
const MEETING_NOTES: BuiltInTemplate = {
  id: 'built-in:meeting-notes',
  meta: {
    name: 'Meeting Notes',
    description: 'Structured template for meeting notes with agenda and action items.',
    variables: [
      {
        name: 'attendees',
        description: 'Comma-separated list of attendees',
        default: '',
      },
      {
        name: 'location',
        description: 'Meeting location or video call link',
        default: '',
      },
    ],
    trigger: '/meeting',
    tags: ['meeting', 'work', 'notes'],
  },
  body: `# {{title}}

**Date:** {{date}}
**Time:** {{time}}
**Attendees:** {{#if attendees}}{{attendees}}{{else}}—{{/if}}
**Location:** {{#if location}}{{location}}{{else}}—{{/if}}

---

## Agenda

1.

## Discussion

{{cursor}}

## Decisions Made

-

## Action Items

| Task | Owner | Due Date |
|------|-------|----------|
|      |       |          |

## Next Meeting


---
*Notes taken by {{author}} on {{date}}*
`,
};

/** Project brief — project planning document. */
const PROJECT_BRIEF: BuiltInTemplate = {
  id: 'built-in:project-brief',
  meta: {
    name: 'Project Brief',
    description: 'Project planning template with goals, scope, and milestones.',
    variables: [
      {
        name: 'status',
        description: 'Project status (e.g. Planning, Active, On Hold, Completed)',
        default: 'Planning',
      },
      {
        name: 'owner',
        description: 'Project owner / lead',
        default: '',
      },
      {
        name: 'deadline',
        description: 'Target completion date (YYYY-MM-DD)',
        default: '',
      },
    ],
    trigger: '/project',
    tags: ['project', 'planning', 'work'],
  },
  body: `# {{title}}

**Status:** {{status}}
**Owner:** {{#if owner}}{{owner}}{{else}}{{author}}{{/if}}
**Start Date:** {{date}}
**Deadline:** {{#if deadline}}{{deadline}}{{else}}TBD{{/if}}

---

## Problem Statement

{{cursor}}

## Goals

-

## Non-Goals (Out of Scope)

-

## Proposed Solution


## Success Metrics

-

## Milestones

| Milestone | Due Date | Status |
|-----------|----------|--------|
|           |          |        |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
|      |            |        |            |

## Resources & References

-

---
*Created by {{author}} on {{date}}*
`,
};

/** Book review — structured book review template. */
const BOOK_REVIEW: BuiltInTemplate = {
  id: 'built-in:book-review',
  meta: {
    name: 'Book Review',
    description: 'Structured book review with key takeaways and quotes.',
    variables: [
      {
        name: 'author_name',
        description: "Book author's name",
        default: '',
      },
      {
        name: 'genre',
        description: 'Book genre (e.g. Non-fiction, Fiction, Biography)',
        default: '',
      },
      {
        name: 'rating',
        description: 'Your rating out of 5 (e.g. ⭐⭐⭐⭐⭐)',
        default: '',
      },
      {
        name: 'date_read',
        description: 'Date you finished reading (YYYY-MM-DD)',
        default: '',
      },
    ],
    trigger: '/book',
    tags: ['book', 'reading', 'review'],
  },
  body: `# {{title}}

**Author:** {{author_name}}
**Genre:** {{#if genre}}{{genre}}{{else}}—{{/if}}
**Rating:** {{#if rating}}{{rating}}{{else}}—/5{{/if}}
**Date Read:** {{#if date_read}}{{date_read}}{{else}}{{date}}{{/if}}
**Reviewed by:** {{author}}

---

## Summary

{{cursor}}

## Key Takeaways

1.
2.
3.

## Favourite Quotes

>

## How It Changed My Thinking


## Would I Recommend It?


---
*Review written on {{date}}*
`,
};

/** Weekly review — end-of-week retrospective. */
const WEEKLY_REVIEW: BuiltInTemplate = {
  id: 'built-in:weekly-review',
  meta: {
    name: 'Weekly Review',
    description: "End-of-week retrospective with wins, learnings, and next week's focus.",
    variables: [
      {
        name: 'week_number',
        description: 'Week number (e.g. W12)',
        default: '',
      },
    ],
    folderDefault: 'Weekly Reviews',
    trigger: '/weekly',
    tags: ['journal', 'weekly', 'productivity', 'retrospective'],
  },
  body: `# Weekly Review — {{#if week_number}}{{week_number}} • {{/if}}{{date}}

**Reviewed by:** {{author}}

---

## Last Week at a Glance

### Accomplished

-

### Didn't Get To

-

## Wins

{{cursor}}

## Learnings & Insights


## Energy & Health


## Focus for Next Week

### Top 3 Priorities

1.
2.
3.

### Projects to Advance


## Habit Tracker

| Habit | M | T | W | T | F | S | S |
|-------|---|---|---|---|---|---|---|
|       |   |   |   |   |   |   |   |

---
*Written on {{datetime}}*
`,
};

/** Bug report — software issue tracking template. */
const BUG_REPORT: BuiltInTemplate = {
  id: 'built-in:bug-report',
  meta: {
    name: 'Bug Report',
    description: 'Software bug report with reproduction steps and environment info.',
    variables: [
      {
        name: 'severity',
        description: 'Bug severity (Critical, High, Medium, Low)',
        default: 'Medium',
      },
      {
        name: 'component',
        description: 'Affected component or module',
        default: '',
      },
      {
        name: 'version',
        description: 'Application version where bug was found',
        default: '',
      },
    ],
    trigger: '/bug',
    tags: ['engineering', 'bug', 'issue-tracking'],
  },
  body: `# Bug: {{title}}

**Date:** {{date}}
**Reported by:** {{author}}
**Severity:** {{severity}}
**Component:** {{#if component}}{{component}}{{else}}—{{/if}}
**Version:** {{#if version}}{{version}}{{else}}—{{/if}}
**Status:** Open

---

## Description

{{cursor}}

## Steps to Reproduce

1.
2.
3.

## Expected Behaviour


## Actual Behaviour


## Screenshots / Logs

\`\`\`
\`\`\`

## Environment

- **OS:**
- **Browser / Runtime:**
- **Version:**

## Possible Fix / Root Cause


---
*Filed on {{datetime}} by {{author}}*
`,
};

/** Research note — structured research / investigation note. */
const RESEARCH_NOTE: BuiltInTemplate = {
  id: 'built-in:research-note',
  meta: {
    name: 'Research Note',
    description: 'Structured template for research notes with sources and conclusions.',
    variables: [
      {
        name: 'topic',
        description: 'Research topic or question',
        default: '',
      },
      {
        name: 'hypothesis',
        description: 'Initial hypothesis or expected outcome',
        default: '',
      },
    ],
    trigger: '/research',
    tags: ['research', 'zettelkasten', 'knowledge'],
  },
  body: `# {{title}}

**Date:** {{date}}
**Researcher:** {{author}}
**Topic:** {{#if topic}}{{topic}}{{else}}{{title}}{{/if}}

---

## Research Question


## Hypothesis

{{#if hypothesis}}{{hypothesis}}{{else}}{{cursor}}{{/if}}

## Background / Context


## Key Sources

-

## Findings

### Finding 1


### Finding 2


## Analysis


## Conclusions


## Open Questions

-

## Related Notes

-

## Tags


---
*Research note created on {{date}} by {{author}}*
`,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All built-in templates in display order. */
export const BUILT_IN_TEMPLATES: readonly BuiltInTemplate[] = [
  BLANK,
  DAILY_NOTE,
  MEETING_NOTES,
  PROJECT_BRIEF,
  BOOK_REVIEW,
  WEEKLY_REVIEW,
  BUG_REPORT,
  RESEARCH_NOTE,
];

/**
 * Looks up a built-in template by its ID.
 *
 * @param id - The built-in template ID (e.g. 'built-in:daily-note').
 * @returns  The template or undefined when not found.
 */
export function getBuiltInTemplate(id: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Returns all built-in templates that match the given tag.
 *
 * @param tag - Tag to filter by.
 */
export function getBuiltInTemplatesByTag(tag: string): BuiltInTemplate[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.meta.tags.includes(tag));
}

/**
 * Returns the built-in template whose trigger matches the given string.
 *
 * @param trigger - Trigger string (e.g. '/daily').
 * @returns        The matching template or undefined.
 */
export function getBuiltInTemplateByTrigger(trigger: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.meta.trigger === trigger);
}

/**
 * Validates that a built-in template has a well-formed structure.
 * Used in tests to guard against accidental regressions.
 */
export function validateBuiltInTemplate(template: BuiltInTemplate): string[] {
  const errors: string[] = [];

  if (!template.id.startsWith('built-in:')) {
    errors.push(`id must start with "built-in:", got "${template.id}"`);
  }
  if (!template.meta.name) {
    errors.push('meta.name must not be empty');
  }
  if (!template.body) {
    errors.push('body must not be empty');
  }
  if (template.meta.trigger && !template.meta.trigger.startsWith('/')) {
    errors.push(`trigger must start with "/", got "${template.meta.trigger}"`);
  }
  for (const v of template.meta.variables) {
    if (!v.name) {
      errors.push('variable name must not be empty');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(v.name)) {
      errors.push(`variable name "${v.name}" contains invalid characters`);
    }
  }

  return errors;
}
