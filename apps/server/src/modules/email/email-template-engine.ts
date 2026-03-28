/**
 * EmailTemplateEngine — lightweight Handlebars-style template engine.
 *
 * Supported syntax:
 *   {{variable}}          — HTML-escaped variable substitution
 *   {{{variable}}}        — Raw (unescaped) variable substitution
 *   {{#if condition}}...{{/if}}      — Conditional blocks (falsy = empty string)
 *   {{#if condition}}...{{else}}...{{/if}} — Conditional with else branch
 *   {{#each items}}...{{/each}}      — Iteration (exposes {{this}} and {{@index}})
 *
 * No external dependencies. Security: all {{variable}} output is HTML-escaped
 * by default; only {{{triple-brace}}} bypasses escaping.
 */

export type TemplateVariables = Record<string, unknown>;

/**
 * Escapes special HTML characters to prevent XSS when interpolating
 * user-supplied values into HTML templates.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Resolves a dot-notation key against a context object.
 * e.g. "user.name" on { user: { name: "Alice" } } → "Alice"
 * Returns undefined for missing paths.
 */
function resolvePath(context: TemplateVariables, key: string): unknown {
  if (key === 'this') return context['this'];

  const parts = key.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Converts any value to its string representation for template output.
 */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Processes {{#each items}}...{{/each}} blocks.
 *
 * Inside the block:
 *   {{this}}    — the current item (if it is a primitive)
 *   {{@index}}  — the zero-based numeric index
 *   {{key}}     — property access when items are objects
 */
function processEachBlocks(template: string, context: TemplateVariables): string {
  // Regex captures: block name, loop body (non-greedy)
  const eachRegex = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachRegex, (_, key: string, body: string) => {
    const items = resolvePath(context, key);

    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }

    return items
      .map((item: unknown, index: number) => {
        // Build a child context that exposes iteration variables
        const childContext: TemplateVariables = {
          ...context,
          this: item,
          '@index': index,
        };

        // If item is an object, merge its properties into child context
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          Object.assign(childContext, item as Record<string, unknown>);
        }

        return renderTemplate(body, childContext);
      })
      .join('');
  });
}

/**
 * Processes {{#if condition}}...{{else}}...{{/if}} blocks (else is optional).
 * A condition is truthy when the resolved value is non-empty, non-zero, non-false,
 * and not an empty array.
 */
function processIfBlocks(template: string, context: TemplateVariables): string {
  // Matches: {{#if key}} thenBody {{else}} elseBody {{/if}}
  // The else clause is optional.
  const ifRegex = /\{\{#if\s+([\w.@]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

  return template.replace(
    ifRegex,
    (_, key: string, thenBody: string, elseBody: string | undefined) => {
      const value = resolvePath(context, key);
      const isTruthy = isTruthyValue(value);

      const branch = isTruthy ? thenBody : (elseBody ?? '');
      return renderTemplate(branch, context);
    },
  );
}

/**
 * Determines whether a template condition value is truthy.
 * Follows the same rules as JavaScript's boolean coercion, with the
 * additional rule that empty arrays are falsy.
 */
function isTruthyValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/**
 * Processes all variable substitutions — both escaped {{var}} and raw {{{var}}}.
 * Variables are resolved via dot-notation path resolution.
 */
function processVariables(template: string, context: TemplateVariables): string {
  // Triple braces first (raw output) — must come before double-brace pass
  const rawResult = template.replace(/\{\{\{([\w.@]+)\}\}\}/g, (_, key: string) => {
    const value = resolvePath(context, key);
    return stringify(value);
  });

  // Double braces (HTML-escaped output)
  return rawResult.replace(/\{\{([\w.@]+)\}\}/g, (_, key: string) => {
    const value = resolvePath(context, key);
    return escapeHtml(stringify(value));
  });
}

/**
 * Renders a template string with the provided variables.
 *
 * Processing order (to allow nested constructs):
 *   1. {{#each}} blocks (innermost first via recursive calls)
 *   2. {{#if}} blocks
 *   3. Variable substitutions
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template;

  // Each blocks may contain if blocks and variables, so process them first
  result = processEachBlocks(result, variables);

  // If blocks may contain variables
  result = processIfBlocks(result, variables);

  // Finally replace all variable references
  result = processVariables(result, variables);

  return result;
}

/**
 * Validates that a template contains no unclosed block tags.
 * Returns a list of issues found (empty = valid).
 */
export function validateTemplate(template: string): string[] {
  const issues: string[] = [];

  const openIf = (template.match(/\{\{#if\s/g) ?? []).length;
  const closeIf = (template.match(/\{\{\/if\}\}/g) ?? []).length;
  if (openIf !== closeIf) {
    issues.push(`Mismatched {{#if}} tags: ${openIf} opening, ${closeIf} closing`);
  }

  const openEach = (template.match(/\{\{#each\s/g) ?? []).length;
  const closeEach = (template.match(/\{\{\/each\}\}/g) ?? []).length;
  if (openEach !== closeEach) {
    issues.push(`Mismatched {{#each}} tags: ${openEach} opening, ${closeEach} closing`);
  }

  return issues;
}
