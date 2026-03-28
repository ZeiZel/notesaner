/**
 * frontmatter-parser.ts
 *
 * Pure YAML-like frontmatter parser and serializer.
 * No external YAML libraries — hand-rolled line-by-line implementation.
 *
 * Supported value types:
 *   - string   — default for unrecognized values
 *   - number   — integers and floats
 *   - boolean  — true / false (case-insensitive)
 *   - date     — ISO 8601 date strings (YYYY-MM-DD)
 *   - array    — YAML block sequences ( - item ) or inline [a, b, c]
 *
 * Limitations (by design — we are not a full YAML parser):
 *   - No nested maps / objects
 *   - No multi-line string values (block scalars)
 *   - No anchors / aliases
 *   - Keys must be valid identifier-like strings (letters, digits, _ -)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FrontmatterValueType = 'string' | 'number' | 'boolean' | 'date' | 'array';

export interface FrontmatterProperty {
  key: string;
  value: string | number | boolean | string[];
  type: FrontmatterValueType;
}

/** Ordered map of frontmatter properties. */
export type FrontmatterMap = Map<string, FrontmatterProperty>;

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

/** Tests a value string against ISO 8601 date pattern YYYY-MM-DD. */
const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * Detects the semantic type of a raw YAML scalar value string.
 * Arrays are handled by the caller before this function is invoked.
 */
export function detectValueType(raw: string): FrontmatterValueType {
  const trimmed = raw.trim();

  // Boolean
  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
    return 'boolean';
  }

  // Number — integer or float, allows leading minus, optional decimal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return 'number';
  }

  // Date — YYYY-MM-DD
  if (ISO_DATE_RE.test(trimmed)) {
    return 'date';
  }

  return 'string';
}

/**
 * Coerces a raw string to its typed JS value.
 * Returns the raw string if the type is string or date.
 */
export function coerceValue(raw: string, type: FrontmatterValueType): string | number | boolean {
  const trimmed = raw.trim();
  switch (type) {
    case 'boolean':
      return /^(true|yes|on)$/i.test(trimmed);
    case 'number':
      return Number(trimmed);
    case 'date':
    case 'string':
    default:
      return trimmed;
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Strips YAML quotes from a scalar value string. */
function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Parses an inline YAML array: [a, b, "c with spaces", 1, true]
 * Returns null if the string does not look like an inline array.
 */
export function parseInlineArray(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;

  const inner = t.slice(1, -1).trim();
  if (inner === '') return [];

  // Split on commas not inside quotes
  const items: string[] = [];
  let current = '';
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];

    if (ch === '"' || ch === "'") {
      if (inQuote === null) {
        inQuote = ch;
      } else if (inQuote === ch) {
        inQuote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === ',' && inQuote === null) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim() !== '') {
    items.push(current.trim());
  }

  return items.map(stripQuotes);
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses a markdown string that may begin with YAML frontmatter (--- ... ---).
 * Returns the parsed property map and the remaining markdown body.
 *
 * If no frontmatter block is present, returns an empty map and the original string.
 */
export function parseFrontmatter(markdown: string): {
  properties: FrontmatterMap;
  body: string;
} {
  const emptyResult = { properties: new Map() as FrontmatterMap, body: markdown };

  if (!markdown.startsWith('---')) {
    return emptyResult;
  }

  const lines = markdown.split('\n');

  // Find closing ---
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return emptyResult;
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const body = lines
    .slice(closingIndex + 1)
    .join('\n')
    .trimStart();

  const properties: FrontmatterMap = new Map();

  // State for block-sequence arrays
  let currentArrayKey: string | null = null;
  let currentArrayItems: string[] = [];

  function flushArray() {
    if (currentArrayKey !== null) {
      properties.set(currentArrayKey, {
        key: currentArrayKey,
        value: currentArrayItems,
        type: 'array',
      });
      currentArrayKey = null;
      currentArrayItems = [];
    }
  }

  for (const line of frontmatterLines) {
    // Skip blank lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Block-sequence item (array element under a key)
    if (line.match(/^  - /)) {
      if (currentArrayKey !== null) {
        const item = stripQuotes(line.slice(4).trim());
        currentArrayItems.push(item);
      }
      continue;
    }

    // A new key:value pair — flush any pending array first
    flushArray();

    // Match key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trimEnd();

    if (!key) continue;

    // Inline array
    const trimmedValue = rawValue.trim();
    const inlineArr = parseInlineArray(trimmedValue);
    if (inlineArr !== null) {
      properties.set(key, { key, value: inlineArr, type: 'array' });
      continue;
    }

    // Empty value — start of block sequence or empty string
    if (trimmedValue === '') {
      // Could be the start of a block sequence; we'll flush on the next key
      currentArrayKey = key;
      currentArrayItems = [];
      continue;
    }

    // Scalar
    const unquoted = stripQuotes(trimmedValue);
    const type = detectValueType(unquoted);
    const value = coerceValue(unquoted, type);

    properties.set(key, { key, value, type });
  }

  // Flush trailing array
  flushArray();

  // If last key had empty value but no items — store as empty string
  if (currentArrayKey !== null && currentArrayItems.length === 0) {
    properties.set(currentArrayKey, { key: currentArrayKey, value: '', type: 'string' });
  }

  return { properties, body };
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/** Quotes a string value if it contains characters that would break YAML. */
function quoteIfNeeded(s: string): string {
  // Quote if: empty, contains leading/trailing whitespace, contains ':' or '#',
  // or looks like a keyword (true, false, yes, no, on, off, null).
  if (
    s === '' ||
    s !== s.trim() ||
    s.includes(':') ||
    s.includes('#') ||
    /^(true|false|yes|no|on|off|null)$/i.test(s) ||
    /^-?\d+(\.\d+)?$/.test(s) ||
    ISO_DATE_RE.test(s)
  ) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Serializes a FrontmatterMap back to a YAML frontmatter block string.
 * Returns an empty string if the map is empty.
 *
 * Arrays are serialized as block sequences (multi-line) when they contain
 * more than one item, and as inline arrays for empty or single-item arrays.
 */
export function serializeFrontmatter(properties: FrontmatterMap): string {
  if (properties.size === 0) return '';

  const lines: string[] = ['---'];

  for (const prop of properties.values()) {
    if (prop.type === 'array') {
      const arr = prop.value as string[];
      if (arr.length === 0) {
        lines.push(`${prop.key}: []`);
      } else if (arr.length === 1) {
        // arr.length === 1 guarantees arr[0] exists; access is safe
        const firstItem = arr[0] ?? '';
        lines.push(`${prop.key}: [${quoteIfNeeded(firstItem)}]`);
      } else {
        lines.push(`${prop.key}:`);
        for (const item of arr) {
          lines.push(`  - ${quoteIfNeeded(item)}`);
        }
      }
    } else if (prop.type === 'boolean') {
      lines.push(`${prop.key}: ${prop.value}`);
    } else if (prop.type === 'number') {
      lines.push(`${prop.key}: ${prop.value}`);
    } else if (prop.type === 'date') {
      lines.push(`${prop.key}: ${prop.value}`);
    } else {
      // string
      const str = String(prop.value ?? '');
      lines.push(`${prop.key}: ${quoteIfNeeded(str)}`);
    }
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * Rebuilds a full markdown document from a property map and a body string.
 */
export function buildMarkdown(properties: FrontmatterMap, body: string): string {
  const fm = serializeFrontmatter(properties);
  if (!fm) return body;
  return `${fm}\n${body ? `\n${body}` : ''}`;
}
