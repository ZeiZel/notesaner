/**
 * css-sanitizer.ts -- Sanitizes user-provided CSS snippets for security.
 *
 * Prevents:
 *   - @import rules (could load external resources)
 *   - url() values (could load external resources or exfiltrate data)
 *   - expression() / -moz-binding (legacy IE/Firefox script injection)
 *   - javascript: protocol in any property value
 *   - behavior: property (IE HTC execution)
 *   - -moz-binding property (XBL binding execution)
 *
 * Preserves:
 *   - All valid CSS rules, selectors, and properties
 *   - CSS custom properties (--variable-name)
 *   - @media, @supports, @keyframes, @layer at-rules
 *   - calc(), var(), clamp(), min(), max() functions
 *   - Data URIs in url() are also blocked (could be used for exfiltration)
 *
 * Design notes:
 *   - This is a blocklist-based approach, not an allowlist parser.
 *   - It provides reasonable security for user CSS snippets injected
 *     via <style> tags. It is NOT a full CSS parser.
 *   - For maximum security, consider CSP style-src directives as well.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanitizeResult {
  /** The sanitized CSS string with dangerous constructs removed. */
  css: string;
  /** List of removed constructs with human-readable descriptions. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Patterns that are unconditionally removed from CSS input.
 * Each entry has a regex pattern and a description for the warning message.
 */
const BLOCKED_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /@import\s+[^;]+;?/gi,
    description: '@import rules are not allowed (external resource loading)',
  },
  {
    pattern: /url\s*\([^)]*\)/gi,
    description: 'url() values are not allowed (external resource loading)',
  },
  {
    pattern: /expression\s*\([^)]*\)/gi,
    description: 'expression() is not allowed (script execution)',
  },
  {
    pattern: /javascript\s*:/gi,
    description: 'javascript: protocol is not allowed',
  },
  {
    pattern: /behavior\s*:\s*[^;]+/gi,
    description: 'behavior property is not allowed (HTC execution)',
  },
  {
    pattern: /-moz-binding\s*:\s*[^;]+/gi,
    description: '-moz-binding property is not allowed (XBL binding)',
  },
  {
    pattern: /-webkit-appearance\s*:\s*none\s*;\s*-moz-appearance\s*:\s*none\s*;/gi,
    description: '', // No warning -- this is not blocked, just for reference
  },
];

// Remove the last entry since it was accidentally added as non-blocked
const EFFECTIVE_PATTERNS = BLOCKED_PATTERNS.slice(0, -1);

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

/**
 * Sanitize a CSS snippet by removing dangerous constructs.
 *
 * @param input - Raw CSS string from the user
 * @returns Sanitized CSS and any warnings about removed content
 *
 * @example
 * ```ts
 * const result = sanitizeCss(`
 *   .my-class { color: red; }
 *   @import url("evil.css");
 *   .other { background: url("data:image/..."); }
 * `);
 *
 * console.log(result.css);
 * // .my-class { color: red; }
 * // .other { background: ; }
 *
 * console.log(result.warnings);
 * // ['@import rules are not allowed (external resource loading)',
 * //  'url() values are not allowed (external resource loading)']
 * ```
 */
export function sanitizeCss(input: string): SanitizeResult {
  const warnings: string[] = [];
  let css = input;

  for (const { pattern, description } of EFFECTIVE_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    if (pattern.test(css)) {
      warnings.push(description);
      // Reset lastIndex again before replacing
      pattern.lastIndex = 0;
      css = css.replace(pattern, '/* [blocked] */');
    }
  }

  // Trim excessive whitespace left by removals
  css = css.replace(/\/\* \[blocked\] \*\/\s*/g, '/* [blocked] */ ');

  return { css: css.trim(), warnings };
}

/**
 * Quick validation check -- returns true if the CSS has no blocked patterns.
 * Useful for form validation without needing the sanitized output.
 */
export function isCssSafe(input: string): boolean {
  return EFFECTIVE_PATTERNS.every(({ pattern }) => {
    pattern.lastIndex = 0;
    return !pattern.test(input);
  });
}

/**
 * Combines multiple CSS snippet strings into a single CSS string.
 * Only includes enabled snippets. Sanitizes each snippet before combining.
 *
 * @param snippets - Array of { css, enabled } objects
 * @returns Combined sanitized CSS string
 */
export function combineSnippets(snippets: { css: string; enabled: boolean }[]): {
  css: string;
  warnings: string[];
} {
  const allWarnings: string[] = [];
  const parts: string[] = [];

  for (const snippet of snippets) {
    if (!snippet.enabled) continue;

    const { css, warnings } = sanitizeCss(snippet.css);
    if (css) {
      parts.push(css);
    }
    allWarnings.push(...warnings);
  }

  return {
    css: parts.join('\n\n'),
    warnings: allWarnings,
  };
}
