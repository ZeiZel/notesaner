/**
 * search-parser.ts — Parse search query strings into structured search filters.
 *
 * Supports the following operators:
 *   - tag:value           Filter by tag name
 *   - folder:path         Filter by folder path (prefix match)
 *   - created:YYYY-MM-DD  Filter by creation date (exact, or range with ..  separator)
 *   - created:>YYYY-MM-DD / created:<YYYY-MM-DD  Date comparison
 *   - modified:YYYY-MM-DD Filter by modification date (same syntax as created)
 *   - has:link             Notes containing wikilinks or markdown links
 *   - has:image            Notes containing image embeds
 *   - has:code             Notes containing code blocks
 *   - has:task             Notes containing task/checkbox items
 *   - -term               Exclude notes matching term
 *   - "exact phrase"       Match exact phrase
 *   - bare words           Full-text search terms
 *
 * Design decisions:
 *   - Pure functions, no side effects, no React dependencies
 *   - Returns a structured ParsedSearch object for the search engine to interpret
 *   - Invalid operators are treated as plain text (graceful degradation)
 *   - Operators are case-insensitive (tag: and TAG: both work)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateOperator = 'exact' | 'before' | 'after' | 'range';

export interface DateFilter {
  operator: DateOperator;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Second date for 'range' operator */
  dateTo?: string;
}

export type HasFilter = 'link' | 'image' | 'code' | 'task';

export interface ParsedSearch {
  /** Positive full-text search terms (bare words and exact phrases) */
  terms: string[];
  /** Exact phrases (from "quoted strings") */
  exactPhrases: string[];
  /** Excluded terms (from -word syntax) */
  excludeTerms: string[];
  /** Tag filters */
  tags: string[];
  /** Folder path filters */
  folders: string[];
  /** Creation date filters */
  createdFilters: DateFilter[];
  /** Modification date filters */
  modifiedFilters: DateFilter[];
  /** Content type filters (has:link, has:image, etc.) */
  hasFilters: HasFilter[];
  /** The original raw query string */
  raw: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_HAS_VALUES: ReadonlySet<string> = new Set(['link', 'image', 'code', 'task']);

const OPERATOR_REGEX = /^(tag|folder|created|modified|has):(.+)$/i;

/** Date pattern: YYYY-MM-DD */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Date range pattern: YYYY-MM-DD..YYYY-MM-DD */
const DATE_RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** Date comparison pattern: >YYYY-MM-DD or <YYYY-MM-DD */
const DATE_COMPARISON_PATTERN = /^([><])(\d{4}-\d{2}-\d{2})$/;

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a search query string into individual tokens.
 *
 * Handles:
 *   - Quoted strings: "exact phrase" -> single token including quotes
 *   - Operator tokens: tag:value -> single token
 *   - Negation: -term -> single token with leading dash
 *   - Bare words: split on whitespace
 */
export function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    if (char === '"') {
      if (inQuotes) {
        // End of quoted string
        current += '"';
        tokens.push(current);
        current = '';
        inQuotes = false;
      } else {
        // Start of quoted string - flush any accumulated chars first
        if (current.trim()) {
          tokens.push(current.trim());
        }
        current = '"';
        inQuotes = true;
      }
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }

    i++;
  }

  // Flush remaining
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Date parser helper
// ---------------------------------------------------------------------------

function parseDateValue(value: string): DateFilter | null {
  // Range: 2024-01-01..2024-12-31
  const rangeMatch = value.match(DATE_RANGE_PATTERN);
  if (rangeMatch) {
    return { operator: 'range', date: rangeMatch[1], dateTo: rangeMatch[2] };
  }

  // Comparison: >2024-01-01 or <2024-01-01
  const compMatch = value.match(DATE_COMPARISON_PATTERN);
  if (compMatch) {
    return {
      operator: compMatch[1] === '>' ? 'after' : 'before',
      date: compMatch[2],
    };
  }

  // Exact: 2024-01-01
  if (DATE_PATTERN.test(value)) {
    return { operator: 'exact', date: value };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a search query string into a structured ParsedSearch object.
 *
 * @param query - Raw search query string
 * @returns ParsedSearch object with all extracted filters and terms
 *
 * @example
 * ```ts
 * parseSearchQuery('tag:journal folder:daily "morning notes" -draft has:link')
 * // {
 * //   terms: ['morning notes'],
 * //   exactPhrases: ['morning notes'],
 * //   excludeTerms: ['draft'],
 * //   tags: ['journal'],
 * //   folders: ['daily'],
 * //   createdFilters: [],
 * //   modifiedFilters: [],
 * //   hasFilters: ['link'],
 * //   raw: 'tag:journal folder:daily "morning notes" -draft has:link'
 * // }
 * ```
 */
export function parseSearchQuery(query: string): ParsedSearch {
  const result: ParsedSearch = {
    terms: [],
    exactPhrases: [],
    excludeTerms: [],
    tags: [],
    folders: [],
    createdFilters: [],
    modifiedFilters: [],
    hasFilters: [],
    raw: query,
  };

  if (!query.trim()) return result;

  const tokens = tokenize(query);

  for (const token of tokens) {
    // Handle quoted exact phrases
    if (token.startsWith('"') && token.endsWith('"') && token.length > 2) {
      const phrase = token.slice(1, -1);
      result.exactPhrases.push(phrase);
      result.terms.push(phrase);
      continue;
    }

    // Handle exclusion
    if (token.startsWith('-') && token.length > 1) {
      const excluded = token.slice(1);
      // Check if the exclusion targets an operator (e.g., -tag:draft)
      const operatorMatch = excluded.match(OPERATOR_REGEX);
      if (operatorMatch) {
        // For now, treat negated operators as excluded terms
        result.excludeTerms.push(excluded);
      } else {
        result.excludeTerms.push(excluded);
      }
      continue;
    }

    // Handle operators
    const operatorMatch = token.match(OPERATOR_REGEX);
    if (operatorMatch) {
      const operator = operatorMatch[1].toLowerCase();
      const value = operatorMatch[2];

      switch (operator) {
        case 'tag':
          result.tags.push(value);
          break;

        case 'folder':
          result.folders.push(value);
          break;

        case 'created': {
          const dateFilter = parseDateValue(value);
          if (dateFilter) {
            result.createdFilters.push(dateFilter);
          } else {
            // Invalid date format, treat as plain text
            result.terms.push(token);
          }
          break;
        }

        case 'modified': {
          const dateFilter = parseDateValue(value);
          if (dateFilter) {
            result.modifiedFilters.push(dateFilter);
          } else {
            result.terms.push(token);
          }
          break;
        }

        case 'has': {
          const hasValue = value.toLowerCase();
          if (VALID_HAS_VALUES.has(hasValue)) {
            result.hasFilters.push(hasValue as HasFilter);
          } else {
            // Unknown has: value, treat as plain text
            result.terms.push(token);
          }
          break;
        }

        default:
          // Unknown operator, treat as plain text
          result.terms.push(token);
      }
      continue;
    }

    // Plain text term
    result.terms.push(token);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Query builder (structured -> string)
// ---------------------------------------------------------------------------

/**
 * Serialize a ParsedSearch back into a query string.
 * Useful for constructing queries programmatically.
 */
export function buildSearchQuery(parsed: ParsedSearch): string {
  const parts: string[] = [];

  // Tags
  for (const tag of parsed.tags) {
    parts.push(`tag:${tag}`);
  }

  // Folders
  for (const folder of parsed.folders) {
    parts.push(`folder:${folder}`);
  }

  // Created filters
  for (const df of parsed.createdFilters) {
    parts.push(`created:${formatDateFilter(df)}`);
  }

  // Modified filters
  for (const df of parsed.modifiedFilters) {
    parts.push(`modified:${formatDateFilter(df)}`);
  }

  // Has filters
  for (const hf of parsed.hasFilters) {
    parts.push(`has:${hf}`);
  }

  // Exact phrases
  for (const phrase of parsed.exactPhrases) {
    parts.push(`"${phrase}"`);
  }

  // Exclude terms
  for (const term of parsed.excludeTerms) {
    parts.push(`-${term}`);
  }

  // Bare terms (exclude exact phrases already added)
  const exactPhraseSet = new Set(parsed.exactPhrases);
  for (const term of parsed.terms) {
    if (!exactPhraseSet.has(term)) {
      parts.push(term);
    }
  }

  return parts.join(' ');
}

function formatDateFilter(df: DateFilter): string {
  switch (df.operator) {
    case 'exact':
      return df.date;
    case 'before':
      return `<${df.date}`;
    case 'after':
      return `>${df.date}`;
    case 'range':
      return `${df.date}..${df.dateTo}`;
  }
}

// ---------------------------------------------------------------------------
// Operator documentation (for SearchOperators help UI)
// ---------------------------------------------------------------------------

export interface SearchOperatorDoc {
  operator: string;
  description: string;
  examples: string[];
}

export const SEARCH_OPERATORS: SearchOperatorDoc[] = [
  {
    operator: 'tag:',
    description: 'Filter notes by tag name',
    examples: ['tag:journal', 'tag:project/alpha'],
  },
  {
    operator: 'folder:',
    description: 'Filter notes by folder path (prefix match)',
    examples: ['folder:daily', 'folder:projects/2024'],
  },
  {
    operator: 'created:',
    description: 'Filter by creation date',
    examples: ['created:2024-01-15', 'created:>2024-01-01', 'created:2024-01-01..2024-12-31'],
  },
  {
    operator: 'modified:',
    description: 'Filter by modification date',
    examples: ['modified:2024-03-01', 'modified:<2024-06-01'],
  },
  {
    operator: 'has:',
    description: 'Filter by content type',
    examples: ['has:link', 'has:image', 'has:code', 'has:task'],
  },
  {
    operator: '"..."',
    description: 'Match an exact phrase',
    examples: ['"meeting notes"', '"project plan"'],
  },
  {
    operator: '-',
    description: 'Exclude notes matching a term',
    examples: ['-draft', '-archived', '-tag:private'],
  },
];
