/**
 * Template file parser.
 *
 * Parses template markdown files which use YAML frontmatter to carry
 * template metadata. The body (everything after the frontmatter block)
 * is the raw template content including {{variable}} tokens.
 *
 * Expected frontmatter schema:
 * ```yaml
 * ---
 * template_name: "Daily Note"
 * template_description: "Daily journaling template with tasks and goals"
 * template_variables:
 *   - name: mood
 *     description: "Your current mood"
 *     default: ""
 *   - name: goal
 *     description: "Main goal for today"
 *     default: ""
 * template_folder_default: "Daily Notes"   # optional: folder this is default for
 * template_trigger: "/daily"              # optional: slash trigger
 * template_tags: ["journal", "daily"]     # optional: categorisation tags
 * ---
 * ```
 *
 * If the file contains no frontmatter block, the entire file content is
 * treated as the template body and metadata defaults are used.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Describes a custom variable defined in the template's frontmatter. */
export interface TemplateVariableMeta {
  /** Variable name (used in {{variable}} tokens). */
  name: string;
  /** Human-readable description shown in the variable input form. */
  description: string;
  /** Default value pre-filled in the input form. Empty string means no default. */
  default: string;
}

/** Parsed template metadata extracted from frontmatter. */
export interface TemplateMeta {
  /** Human-readable template name. Derived from filename when absent. */
  name: string;
  /** Optional short description shown in the template picker. */
  description: string;
  /** Declared custom variables with descriptions and defaults. */
  variables: TemplateVariableMeta[];
  /**
   * Optional folder name this template is the default for.
   * When a note is created inside this folder, the template is auto-selected.
   */
  folderDefault?: string;
  /**
   * Optional slash command trigger (e.g. "/daily").
   * When the user types this trigger in the command palette, the template
   * is applied immediately.
   */
  trigger?: string;
  /** Optional categorisation tags for the template picker. */
  tags: string[];
}

/** Result of parsing a template file. */
export interface ParsedTemplate {
  /** Extracted metadata from frontmatter. */
  meta: TemplateMeta;
  /** Template body content (everything after the frontmatter block). */
  body: string;
  /** True when frontmatter was successfully parsed. */
  hasFrontmatter: boolean;
}

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

/**
 * Splits a markdown file into its YAML frontmatter block and body.
 *
 * Returns null for the frontmatter portion when the file does not start
 * with a `---` delimiter.
 */
function splitFrontmatter(content: string): { raw: string | null; body: string } {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith('---')) {
    return { raw: null, body: content };
  }

  // Find the closing --- delimiter.
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) {
    return { raw: null, body: content };
  }

  const afterFirstDash = trimmed.slice(firstNewline + 1);
  const closingIdx = afterFirstDash.indexOf('\n---');

  if (closingIdx === -1) {
    // Try a closing --- at end of file.
    if (afterFirstDash.trimEnd() === '---') {
      return { raw: '', body: '' };
    }
    return { raw: null, body: content };
  }

  const raw = afterFirstDash.slice(0, closingIdx);
  // +1 for the \n before ---, +4 for \n---
  const bodyStart = closingIdx + 4;
  const body = afterFirstDash.slice(bodyStart).replace(/^\n/, '');

  return { raw, body };
}

// ---------------------------------------------------------------------------
// YAML mini-parser
// ---------------------------------------------------------------------------

/**
 * Minimal YAML parser that handles the subset used in template frontmatter.
 *
 * Supports:
 * - Top-level key: value pairs
 * - Quoted string values (single or double quotes)
 * - Inline arrays: [item1, item2]
 * - Block sequences (- item)
 * - Nested mappings (two-space indent)
 *
 * This avoids pulling in a full YAML library as a peer dependency.
 */
function parseYaml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments.
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (rawValue === '') {
      // Could be a block sequence or nested mapping.
      const children: unknown[] = [];
      const childMappings: Record<string, unknown>[] = [];
      let isMapping = false;

      i++;
      while (i < lines.length) {
        const childLine = lines[i];
        const childTrimmed = childLine.trim();

        if (!childTrimmed || childTrimmed.startsWith('#')) {
          i++;
          continue;
        }

        // Check indent level — child lines must be indented.
        const indent = childLine.length - childLine.trimStart().length;
        if (indent === 0) break;

        if (childTrimmed.startsWith('- ')) {
          // Block sequence item.
          const itemVal = childTrimmed.slice(2).trim();
          // Check if item is a mapping (has subkeys).
          const innerLines: string[] = [];
          innerLines.push('  ' + itemVal);

          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextIndent = nextLine.length - nextLine.trimStart().length;
            if (nextIndent <= indent) break;
            innerLines.push(nextLine);
            j++;
          }

          // If there are sublines starting with a key, treat as mapping.
          if (innerLines.some((l) => /^\s+\w+\s*:/.test(l))) {
            isMapping = true;
            const childMap: Record<string, unknown> = {};
            for (const inner of innerLines) {
              const innerTrimmed = inner.trim();
              const innerColon = innerTrimmed.indexOf(':');
              if (innerColon === -1) continue;
              const k = innerTrimmed.slice(0, innerColon).trim();
              const v = innerTrimmed.slice(innerColon + 1).trim();
              childMap[k] = unquote(v);
            }
            childMappings.push(childMap);
            i = j;
          } else {
            children.push(unquote(itemVal));
            i++;
          }
        } else {
          break;
        }
      }

      result[key] = isMapping ? childMappings : children;
      continue;
    }

    // Inline array.
    if (rawValue.startsWith('[')) {
      result[key] = parseInlineArray(rawValue);
      i++;
      continue;
    }

    result[key] = unquote(rawValue);
    i++;
  }

  return result;
}

/** Removes surrounding quotes from a YAML scalar value. */
function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Parses a YAML inline array like ["a", "b", c]. */
function parseInlineArray(raw: string): string[] {
  const inner = raw.slice(1, raw.lastIndexOf(']'));
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Derives a default template name from a file path.
 * Uses the last path segment without the extension.
 */
function nameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] ?? 'Untitled';
  const dotIdx = filename.lastIndexOf('.');
  return dotIdx === -1 ? filename : filename.slice(0, dotIdx);
}

/**
 * Extracts TemplateVariableMeta from the raw YAML `template_variables` value.
 */
function extractVariables(raw: unknown): TemplateVariableMeta[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: typeof item['name'] === 'string' ? item['name'] : '',
      description: typeof item['description'] === 'string' ? item['description'] : '',
      default: typeof item['default'] === 'string' ? item['default'] : '',
    }))
    .filter((v) => v.name.length > 0);
}

/**
 * Extracts tags from the raw YAML `template_tags` value.
 * Accepts both inline arrays and comma-separated strings.
 */
function extractTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a template markdown file into its metadata and body.
 *
 * @param content  - Raw file content (may include YAML frontmatter).
 * @param filePath - Optional file path used to derive a default name.
 * @returns        ParsedTemplate with extracted metadata and body.
 */
export function parseTemplateFile(content: string, filePath?: string): ParsedTemplate {
  const { raw, body } = splitFrontmatter(content);

  if (raw === null) {
    // No frontmatter — treat entire content as body.
    const name = filePath ? nameFromPath(filePath) : 'Untitled';
    return {
      meta: {
        name,
        description: '',
        variables: [],
        tags: [],
      },
      body: content,
      hasFrontmatter: false,
    };
  }

  const yaml = parseYaml(raw);

  const meta: TemplateMeta = {
    name:
      typeof yaml['template_name'] === 'string' && yaml['template_name'].length > 0
        ? yaml['template_name']
        : filePath
          ? nameFromPath(filePath)
          : 'Untitled',
    description:
      typeof yaml['template_description'] === 'string' ? yaml['template_description'] : '',
    variables: extractVariables(yaml['template_variables']),
    folderDefault:
      typeof yaml['template_folder_default'] === 'string'
        ? yaml['template_folder_default']
        : undefined,
    trigger: typeof yaml['template_trigger'] === 'string' ? yaml['template_trigger'] : undefined,
    tags: extractTags(yaml['template_tags']),
  };

  return {
    meta,
    body: body.trim(),
    hasFrontmatter: true,
  };
}

/**
 * Serialises a TemplateMeta and body back into a markdown file with YAML
 * frontmatter.
 *
 * @param meta - Template metadata to encode.
 * @param body - Template body content.
 * @returns    Serialised markdown string.
 */
export function serializeTemplate(meta: TemplateMeta, body: string): string {
  const lines: string[] = ['---'];

  lines.push(`template_name: "${escapeFm(meta.name)}"`);

  if (meta.description) {
    lines.push(`template_description: "${escapeFm(meta.description)}"`);
  }

  if (meta.variables.length > 0) {
    lines.push('template_variables:');
    for (const v of meta.variables) {
      lines.push(`  - name: ${v.name}`);
      if (v.description) lines.push(`    description: "${escapeFm(v.description)}"`);
      if (v.default) lines.push(`    default: "${escapeFm(v.default)}"`);
    }
  }

  if (meta.folderDefault) {
    lines.push(`template_folder_default: "${escapeFm(meta.folderDefault)}"`);
  }

  if (meta.trigger) {
    lines.push(`template_trigger: "${escapeFm(meta.trigger)}"`);
  }

  if (meta.tags.length > 0) {
    lines.push(`template_tags: [${meta.tags.map((t) => `"${t}"`).join(', ')}]`);
  }

  lines.push('---');
  lines.push('');
  lines.push(body);

  return lines.join('\n');
}

/** Escapes double quotes in frontmatter string values. */
function escapeFm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
