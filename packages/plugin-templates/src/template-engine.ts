/**
 * Template engine for variable substitution and conditional blocks.
 *
 * Supports:
 * - Built-in variables: {{date}}, {{time}}, {{datetime}}, {{title}}, {{author}}, {{cursor}}
 * - Custom variables: any {{variable}} syntax
 * - Conditional blocks: {{#if variable}}...{{/if}}
 * - Else branches: {{#if variable}}...{{else}}...{{/if}}
 * - Nested variables within conditional blocks
 *
 * The {{cursor}} placeholder is replaced with an empty string in the rendered
 * output. Callers should locate it in the original template to position the
 * editor cursor after applying the template.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Built-in variable names that the engine resolves automatically. */
export type BuiltInVariable = 'date' | 'time' | 'datetime' | 'title' | 'author' | 'cursor';

/** Context provided to the engine when rendering a template. */
export interface RenderContext {
  /** The title of the note being created. Defaults to empty string. */
  title?: string;
  /** The author / username. Defaults to empty string. */
  author?: string;
  /** Date to use for {{date}}, {{time}}, {{datetime}}. Defaults to now. */
  now?: Date;
  /** Locale for date/time formatting. Defaults to 'en-US'. */
  locale?: string;
  /** Custom variable values keyed by variable name. */
  variables?: Record<string, string>;
}

/** Result of rendering a template. */
export interface RenderResult {
  /** The rendered content with all variables substituted. */
  content: string;
  /**
   * Zero-based character offset of the cursor position in the rendered
   * content. Present only when the template contains {{cursor}}.
   * The {{cursor}} placeholder itself is removed from the content.
   */
  cursorOffset?: number;
  /** Variables that were present in the template but had no value in context. */
  unresolvedVariables: string[];
}

/** Describes a variable extracted from a template. */
export interface TemplateVariable {
  /** The variable name (without braces). */
  name: string;
  /** True when the variable is a built-in (auto-resolved). */
  isBuiltIn: boolean;
}

// ---------------------------------------------------------------------------
// Built-in resolution
// ---------------------------------------------------------------------------

const BUILT_IN_NAMES: ReadonlySet<string> = new Set<BuiltInVariable>([
  'date',
  'time',
  'datetime',
  'title',
  'author',
  'cursor',
]);

/**
 * Formats a date as YYYY-MM-DD.
 */
function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Formats a time as HH:MM (24-hour).
 */
function formatTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Resolves a built-in variable name to a string value.
 * Returns undefined for unknown built-in names.
 */
function resolveBuiltIn(
  name: string,
  now: Date,
  locale: string,
  ctx: RenderContext,
): string | undefined {
  switch (name) {
    case 'date':
      return formatDate(now, locale);
    case 'time':
      return formatTime(now, locale);
    case 'datetime':
      return `${formatDate(now, locale)} ${formatTime(now, locale)}`;
    case 'title':
      return ctx.title ?? '';
    case 'author':
      return ctx.author ?? '';
    case 'cursor':
      // Cursor is handled as a special token — return a sentinel.
      return '\x00CURSOR\x00';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

// Matches {{variableName}} — variable names can contain letters, digits, _-
const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;

// Matches {{#if variable}} ... {{/if}} optionally with {{else}} inside.
// We use a non-greedy match and handle nesting via the parse loop below.
const CONDITIONAL_OPEN_PATTERN = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;
const CONDITIONAL_CLOSE = '{{/if}}';
const ELSE_TOKEN = '{{else}}';

// ---------------------------------------------------------------------------
// Conditional block processing
// ---------------------------------------------------------------------------

/**
 * Processes all {{#if var}}...{{/if}} blocks in the template string.
 *
 * Nested conditionals are supported. The function processes outermost
 * blocks first and recurses into the chosen branch.
 */
function processConditionals(
  template: string,
  getValue: (name: string) => string | undefined,
): string {
  let result = template;
  let safety = 0;
  const MAX_ITERATIONS = 200;

  // Keep processing until no more conditional opens are found.
  while (safety++ < MAX_ITERATIONS) {
    const openMatch = CONDITIONAL_OPEN_PATTERN.exec(result);
    if (!openMatch) break;

    const openIndex = openMatch.index;
    const varName = openMatch[1];
    const afterOpen = openIndex + openMatch[0].length;

    // Find the matching {{/if}} respecting nesting depth.
    let depth = 1;
    let searchPos = afterOpen;
    let closeIndex = -1;

    while (searchPos < result.length) {
      const nextOpen = result.indexOf('{{#if', searchPos);
      const nextClose = result.indexOf(CONDITIONAL_CLOSE, searchPos);

      if (nextClose === -1) {
        // No closing tag — malformed template, stop.
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchPos = nextOpen + 5;
      } else {
        depth--;
        if (depth === 0) {
          closeIndex = nextClose;
          break;
        }
        searchPos = nextClose + CONDITIONAL_CLOSE.length;
      }
    }

    if (closeIndex === -1) {
      // Malformed — no matching /if. Reset regex and move on.
      CONDITIONAL_OPEN_PATTERN.lastIndex = afterOpen;
      continue;
    }

    // Extract block content.
    const blockContent = result.slice(afterOpen, closeIndex);
    const fullBlock = result.slice(openIndex, closeIndex + CONDITIONAL_CLOSE.length);

    // Split on {{else}} at depth 0 only.
    const elseIndex = findElseAtDepthZero(blockContent);
    let thenBranch: string;
    let elseBranch: string;

    if (elseIndex === -1) {
      thenBranch = blockContent;
      elseBranch = '';
    } else {
      thenBranch = blockContent.slice(0, elseIndex);
      elseBranch = blockContent.slice(elseIndex + ELSE_TOKEN.length);
    }

    // Evaluate condition: truthy when the variable has a non-empty value.
    const value = getValue(varName);
    const isTruthy = value !== undefined && value !== '';
    const chosen = isTruthy ? thenBranch : elseBranch;

    // Replace the full block with the chosen branch (recurse to handle nesting).
    const processed = processConditionals(chosen, getValue);
    result = result.slice(0, openIndex) + processed + result.slice(openIndex + fullBlock.length);

    // Reset regex to scan from the beginning of the replacement.
    CONDITIONAL_OPEN_PATTERN.lastIndex = 0;
  }

  return result;
}

/**
 * Finds the index of {{else}} at nesting depth 0 within a block body.
 * Returns -1 if not found.
 */
function findElseAtDepthZero(body: string): number {
  let depth = 0;
  let i = 0;

  while (i < body.length) {
    const nextOpen = body.indexOf('{{#if', i);
    const nextClose = body.indexOf(CONDITIONAL_CLOSE, i);
    const nextElse = body.indexOf(ELSE_TOKEN, i);

    // Find the earliest occurrence.
    const candidates: Array<[number, string]> = [];
    if (nextOpen !== -1) candidates.push([nextOpen, 'open']);
    if (nextClose !== -1) candidates.push([nextClose, 'close']);
    if (nextElse !== -1) candidates.push([nextElse, 'else']);

    if (candidates.length === 0) break;

    candidates.sort((a, b) => a[0] - b[0]);
    const [pos, type] = candidates[0];

    if (type === 'open') {
      depth++;
      i = pos + 5;
    } else if (type === 'close') {
      depth--;
      i = pos + CONDITIONAL_CLOSE.length;
    } else {
      // else
      if (depth === 0) return pos;
      i = pos + ELSE_TOKEN.length;
    }
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

/**
 * Substitutes all {{variable}} tokens in the given string using the
 * provided getValue function.
 *
 * Variables with no resolved value are left as-is.
 * Records all variable names that could not be resolved in unresolvedVars.
 */
function substituteVariables(
  template: string,
  getValue: (name: string) => string | undefined,
  unresolvedVars: Set<string>,
): string {
  return template.replace(VARIABLE_PATTERN, (_match, name: string) => {
    const value = getValue(name);
    if (value === undefined) {
      unresolvedVars.add(name);
      return _match; // Leave unresolved variables as-is.
    }
    return value;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a template string with variable substitution and conditional
 * block processing.
 *
 * @param template - Raw template content including {{variable}} tokens.
 * @param ctx      - Render context with values for variables.
 * @returns        RenderResult with content, optional cursorOffset, and
 *                 a list of variable names that could not be resolved.
 */
export function renderTemplate(template: string, ctx: RenderContext = {}): RenderResult {
  const now = ctx.now ?? new Date();
  const locale = ctx.locale ?? 'en-US';
  const customVars = ctx.variables ?? {};
  const unresolvedVars = new Set<string>();

  /**
   * Single lookup function used by both conditional processing and variable
   * substitution. Custom variables take precedence over built-ins.
   */
  function getValue(name: string): string | undefined {
    // Custom variable lookup.
    if (Object.prototype.hasOwnProperty.call(customVars, name)) {
      return customVars[name];
    }
    // Built-in lookup.
    if (BUILT_IN_NAMES.has(name)) {
      return resolveBuiltIn(name, now, locale, ctx);
    }
    return undefined;
  }

  // 1. Process conditional blocks first so variable substitution applies to
  //    whichever branch is selected.
  const afterConditionals = processConditionals(template, getValue);

  // 2. Substitute remaining {{variable}} tokens.
  const afterVars = substituteVariables(afterConditionals, getValue, unresolvedVars);

  // 3. Locate and strip the cursor sentinel.
  const SENTINEL = '\x00CURSOR\x00';
  const sentinelIndex = afterVars.indexOf(SENTINEL);
  let content: string;
  let cursorOffset: number | undefined;

  if (sentinelIndex !== -1) {
    content = afterVars.slice(0, sentinelIndex) + afterVars.slice(sentinelIndex + SENTINEL.length);
    cursorOffset = sentinelIndex;
  } else {
    content = afterVars;
  }

  return {
    content,
    cursorOffset,
    unresolvedVariables: Array.from(unresolvedVars),
  };
}

/**
 * Extracts all variable names referenced in a template string.
 *
 * Scans both normal {{variable}} tokens and {{#if variable}} conditional
 * openers. Deduplicates results.
 *
 * @param template - Raw template content.
 * @returns Array of TemplateVariable descriptors in order of first appearance.
 */
export function extractVariables(template: string): TemplateVariable[] {
  const seen = new Set<string>();
  const result: TemplateVariable[] = [];

  const addVar = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    result.push({ name, isBuiltIn: BUILT_IN_NAMES.has(name) });
  };

  // Conditional openers.
  const condPattern = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = condPattern.exec(template)) !== null) {
    addVar(m[1]);
  }

  // Regular variables.
  const varPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;
  while ((m = varPattern.exec(template)) !== null) {
    const name = m[1];
    // Skip conditional syntax tokens.
    if (name.startsWith('#') || name.startsWith('/') || name === 'else') continue;
    addVar(name);
  }

  return result;
}

/**
 * Returns the list of custom variable names (non-built-in) referenced by the
 * template. These are variables that the user must supply values for before
 * applying the template.
 *
 * @param template - Raw template content.
 */
export function getRequiredCustomVariables(template: string): string[] {
  return extractVariables(template)
    .filter((v) => !v.isBuiltIn && v.name !== 'cursor')
    .map((v) => v.name);
}

/**
 * Finds the character offset of the {{cursor}} placeholder in a template.
 *
 * Returns undefined when the template does not contain {{cursor}}.
 * The offset accounts for all variable tokens being at their natural length
 * (it reflects position in the raw template, not the rendered output).
 *
 * For the rendered output cursor offset, use RenderResult.cursorOffset.
 */
export function findCursorPlaceholder(template: string): number | undefined {
  const idx = template.indexOf('{{cursor}}');
  return idx === -1 ? undefined : idx;
}
