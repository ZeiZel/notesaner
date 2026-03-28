/**
 * Clipping templates for the web clipper plugin.
 *
 * Each template defines a Handlebars-like structure rendered with
 * clip metadata at save time. Supports the following placeholders:
 *
 *   {{title}}         — Article/page title
 *   {{url}}           — Source URL
 *   {{author}}        — Extracted author (empty string when absent)
 *   {{date}}          — Publication date (ISO or human-readable)
 *   {{clippedAt}}     — ISO timestamp when the clip was created
 *   {{siteName}}      — Website name (from og:site_name)
 *   {{content}}       — Main content (Markdown-converted article body)
 *   {{selection}}     — Selected text (for Highlight template)
 *   {{description}}   — Page meta description / excerpt
 *   {{tags}}          — Comma-separated tag list
 *   {{screenshot}}    — Screenshot embed (for Screenshot template)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All data available to a template renderer. */
export interface TemplateContext {
  title: string;
  url: string;
  author?: string;
  date?: string;
  clippedAt: string;
  siteName?: string;
  content?: string;
  selection?: string;
  description?: string;
  tags?: string[];
  screenshot?: string;
}

/** A named clip template definition. */
export interface ClipTemplate {
  /** Stable identifier used in store/settings. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Description of what this template is best suited for. */
  description: string;
  /** Template body string with {{placeholder}} syntax. */
  body: string;
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

/**
 * Article template — full article clip with title, metadata, and content.
 * Best for long-form articles and blog posts.
 */
export const TEMPLATE_ARTICLE: ClipTemplate = {
  id: 'article',
  name: 'Article',
  description: 'Full article with title, author, source, date, and content.',
  body: `---
title: "{{title}}"
source: "{{url}}"
author: "{{author}}"
published: "{{date}}"
clipped: "{{clippedAt}}"
site: "{{siteName}}"
tags: [{{tagList}}]
type: article
---

# {{title}}

> **Source**: [{{siteName}}]({{url}}){{#author}}
> **Author**: {{author}}{{/author}}{{#date}}
> **Published**: {{date}}{{/date}}
> **Clipped**: {{clippedAt}}

---

{{content}}
`,
};

/**
 * Bookmark template — lightweight bookmark with title, URL, and description.
 * Best for quick reference saving.
 */
export const TEMPLATE_BOOKMARK: ClipTemplate = {
  id: 'bookmark',
  name: 'Bookmark',
  description: 'Minimal bookmark with title, URL, and description.',
  body: `---
title: "{{title}}"
url: "{{url}}"
site: "{{siteName}}"
clipped: "{{clippedAt}}"
tags: [{{tagList}}]
type: bookmark
---

# {{title}}

**URL**: [{{url}}]({{url}}){{#siteName}}
**Site**: {{siteName}}{{/siteName}}
**Clipped**: {{clippedAt}}

{{description}}
`,
};

/**
 * Highlight template — selected text with source attribution.
 * Best for saving specific passages or quotes.
 */
export const TEMPLATE_HIGHLIGHT: ClipTemplate = {
  id: 'highlight',
  name: 'Highlight',
  description: 'Selected text excerpt with source URL.',
  body: `---
title: "{{title}}"
source: "{{url}}"
clipped: "{{clippedAt}}"
tags: [{{tagList}}]
type: highlight
---

> {{selection}}

— [{{title}}]({{url}}){{#author}} by {{author}}{{/author}}{{#date}} · {{date}}{{/date}}

**Clipped**: {{clippedAt}}
`,
};

/**
 * Screenshot template — embedded screenshot image with source attribution.
 * Best for visual captures of pages or portions of pages.
 */
export const TEMPLATE_SCREENSHOT: ClipTemplate = {
  id: 'screenshot',
  name: 'Screenshot',
  description: 'Screenshot of the page embedded as an image.',
  body: `---
title: "{{title}}"
source: "{{url}}"
clipped: "{{clippedAt}}"
tags: [{{tagList}}]
type: screenshot
---

# {{title}}

{{screenshot}}

**Source**: [{{url}}]({{url}})
**Clipped**: {{clippedAt}}
`,
};

/** All built-in templates indexed by id. */
export const DEFAULT_TEMPLATES: Record<string, ClipTemplate> = {
  [TEMPLATE_ARTICLE.id]: TEMPLATE_ARTICLE,
  [TEMPLATE_BOOKMARK.id]: TEMPLATE_BOOKMARK,
  [TEMPLATE_HIGHLIGHT.id]: TEMPLATE_HIGHLIGHT,
  [TEMPLATE_SCREENSHOT.id]: TEMPLATE_SCREENSHOT,
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Renders a template body with the provided context.
 *
 * Supports:
 * - `{{placeholder}}` — simple value substitution (empty string if absent)
 * - `{{#key}}...{{/key}}` — conditional block (rendered only when key is truthy)
 * - `{{tagList}}` — tags array rendered as comma-separated quoted strings
 *
 * @param template - The ClipTemplate to render.
 * @param ctx      - Data context with values for placeholders.
 * @returns Rendered Markdown string.
 */
export function renderTemplate(template: ClipTemplate, ctx: TemplateContext): string {
  let output = template.body;

  // Render {{tagList}} specially
  const tagList = ctx.tags && ctx.tags.length > 0 ? ctx.tags.map((t) => `"${t}"`).join(', ') : '';
  output = output.replace(/\{\{tagList\}\}/g, tagList);

  // Render conditional blocks {{#key}}...{{/key}}
  output = output.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const value = (ctx as unknown as Record<string, unknown>)[key];
    return value ? content : '';
  });

  // Render simple placeholders
  const placeholders: Record<string, string> = {
    title: ctx.title ?? '',
    url: ctx.url ?? '',
    author: ctx.author ?? '',
    date: ctx.date ?? '',
    clippedAt: ctx.clippedAt ?? '',
    siteName: ctx.siteName ?? '',
    content: ctx.content ?? '',
    selection: ctx.selection ?? '',
    description: ctx.description ?? '',
    screenshot: ctx.screenshot ?? '',
  };

  for (const [key, value] of Object.entries(placeholders)) {
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return output;
}

/**
 * Returns the appropriate default template for a given clip mode.
 */
export function getDefaultTemplate(
  mode: 'full' | 'article' | 'selection' | 'screenshot',
): ClipTemplate {
  switch (mode) {
    case 'article':
      return TEMPLATE_ARTICLE;
    case 'selection':
      return TEMPLATE_HIGHLIGHT;
    case 'screenshot':
      return TEMPLATE_SCREENSHOT;
    case 'full':
    default:
      return TEMPLATE_ARTICLE;
  }
}

/**
 * Generates the frontmatter-safe note filename from a clip title.
 * Replaces non-alphanumeric characters with hyphens and lowercases.
 */
export function titleToFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled-clip'
  );
}
