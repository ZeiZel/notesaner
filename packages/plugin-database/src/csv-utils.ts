/**
 * csv-utils.ts — CSV import and export logic for database rows.
 *
 * Export: Converts DatabaseRow[] + ColumnDefinition[] → RFC 4180 CSV string.
 * Import: Parses a CSV string → DatabaseRow[] with auto-detected column types.
 *
 * Design choices:
 * - Handles quoted fields with escaped double-quotes ("" inside quotes)
 * - Multi-select values exported as semicolon-delimited within a quoted cell
 * - Boolean columns: "true"/"false" / "yes"/"no" / "1"/"0" all accepted on import
 * - Date columns: ISO 8601 strings preserved as-is
 * - Formula columns are excluded from import (read-only computed values)
 * - The first column in the export is always "Title" (the note title)
 */

import type { CellValue, ColumnDefinition, DatabaseRow } from './database-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvExportOptions {
  /** Columns to include. Defaults to all non-formula, non-hidden columns. */
  columnIds?: string[];
  /** Line ending style. Defaults to CRLF per RFC 4180. */
  lineEnding?: '\r\n' | '\n';
  /** Character used as multi-select delimiter inside a cell. Defaults to ";". */
  multiSelectDelimiter?: string;
}

export interface CsvImportOptions {
  /**
   * Map from CSV header name to existing column ID.
   * Columns not in this map will be created as new text columns.
   */
  columnMapping?: Record<string, string>;
  /**
   * Whether to skip the first row if it looks like a duplicate header.
   * Defaults to true.
   */
  skipDuplicateHeader?: boolean;
}

export interface CsvImportResult {
  /** Parsed rows (id is a temporary UUID-style placeholder). */
  rows: Array<{
    title: string;
    values: Record<string, CellValue>;
  }>;
  /** CSV headers found (excludes "Title" column). */
  headers: string[];
  /** Total number of data rows parsed (excluding header). */
  rowCount: number;
  /** Non-fatal warnings (e.g. unknown column). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Low-level CSV helpers
// ---------------------------------------------------------------------------

/**
 * Escape a single cell value for CSV output.
 * Wraps in double-quotes if the value contains commas, newlines, or quotes.
 */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a single CSV line into an array of field values.
 * Handles RFC 4180 quoted fields including embedded newlines (if the caller
 * passes pre-joined multi-line values).
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      // Consume trailing comma
      if (line[i] === ',') i++;
    } else {
      // Unquoted field — read until comma or end-of-line
      const start = i;
      while (i < line.length && line[i] !== ',') i++;
      fields.push(line.slice(start, i));
      if (i < line.length && line[i] === ',') i++;
    }
  }

  // Handle trailing comma: a line ending with comma means one final empty field
  if (line.endsWith(',')) {
    fields.push('');
  }

  return fields;
}

/**
 * Split a CSV string into logical rows, handling quoted fields that span lines.
 */
export function splitCsvRows(csv: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === '\n' || (ch === '\r' && csv[i + 1] === '\n')) && !inQuotes) {
      if (ch === '\r') i++; // skip \n of \r\n
      rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) rows.push(current);

  return rows;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export an array of database rows to a CSV string.
 *
 * The "Title" column is always first. Columns are ordered by their definition
 * order unless `columnIds` option is provided.
 */
export function exportToCsv(
  rows: DatabaseRow[],
  columns: ColumnDefinition[],
  options: CsvExportOptions = {},
): string {
  const { columnIds, lineEnding = '\r\n', multiSelectDelimiter = ';' } = options;

  // Determine which columns to include
  const includedColumns = columnIds
    ? columns.filter((c) => columnIds.includes(c.id))
    : columns.filter((c) => c.type !== 'formula' && !c.hidden);

  // Build header row
  const headers = ['Title', ...includedColumns.map((c) => c.name)];
  const csvRows: string[] = [headers.map(escapeCsvCell).join(',')];

  // Build data rows
  for (const row of rows) {
    const cells: string[] = [escapeCsvCell(row.title)];

    for (const col of includedColumns) {
      const rawValue: CellValue = row.values[col.id];
      cells.push(escapeCsvCell(formatCellForCsv(rawValue, col, multiSelectDelimiter)));
    }

    csvRows.push(cells.join(','));
  }

  return csvRows.join(lineEnding);
}

/** Convert a cell value to a string representation for CSV export. */
function formatCellForCsv(
  value: CellValue,
  column: ColumnDefinition,
  multiSelectDelimiter: string,
): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(multiSelectDelimiter);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (column.type === 'number' && typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string and return rows mapped to column IDs.
 *
 * Rows without a title are skipped. Values are coerced to their target
 * type based on the `columnMapping` option; unrecognised columns are
 * returned as text.
 */
export function importFromCsv(
  csvContent: string,
  columns: ColumnDefinition[],
  options: CsvImportOptions = {},
): CsvImportResult {
  const { columnMapping = {}, skipDuplicateHeader = true } = options;
  const warnings: string[] = [];

  const rawRows = splitCsvRows(csvContent.trim());
  if (rawRows.length === 0) {
    return { rows: [], headers: [], rowCount: 0, warnings };
  }

  // Parse header row
  const headerRow = parseCsvLine(rawRows[0]);
  const titleIndex = headerRow.findIndex((h) => h.toLowerCase() === 'title');

  // Build column lookup by name (case-insensitive) and by mapping
  const colByName = new Map<string, ColumnDefinition>(
    columns.map((c) => [c.name.toLowerCase(), c]),
  );
  const colById = new Map<string, ColumnDefinition>(columns.map((c) => [c.id, c]));

  // Resolve each CSV header to a column
  const columnResolvers: Array<{ header: string; column: ColumnDefinition | null }> = headerRow.map(
    (header) => {
      if (header.toLowerCase() === 'title') return { header, column: null };

      // Explicit mapping takes priority
      const mappedId = columnMapping[header];
      if (mappedId) {
        const col = colById.get(mappedId);
        if (col) return { header, column: col };
      }

      // Name-based lookup
      const col = colByName.get(header.toLowerCase());
      if (col) return { header, column: col };

      warnings.push(`Column "${header}" not found in schema — will be imported as text`);
      return { header, column: null };
    },
  );

  const dataRows = rawRows.slice(1).filter((r) => r.trim().length > 0);

  // Skip duplicate header row (some exports include it twice)
  let startIndex = 0;
  if (skipDuplicateHeader && dataRows.length > 0) {
    const firstData = parseCsvLine(dataRows[0]);
    const isHeader = firstData.every(
      (cell, i) => cell.toLowerCase() === (headerRow[i] ?? '').toLowerCase(),
    );
    if (isHeader) startIndex = 1;
  }

  const importedRows: CsvImportResult['rows'] = [];

  for (let rowIdx = startIndex; rowIdx < dataRows.length; rowIdx++) {
    const cells = parseCsvLine(dataRows[rowIdx]);

    const titleCell = titleIndex >= 0 ? (cells[titleIndex] ?? '').trim() : (cells[0] ?? '').trim();

    if (!titleCell) continue; // Skip rows with no title

    const values: Record<string, CellValue> = {};

    for (let colIdx = 0; colIdx < columnResolvers.length; colIdx++) {
      const { header, column } = columnResolvers[colIdx];
      if (header.toLowerCase() === 'title') continue;

      const rawCell = cells[colIdx] ?? '';
      const colId = column?.id ?? `_import_${header.toLowerCase().replace(/\s+/g, '_')}`;
      values[colId] = coerceCsvCell(rawCell, column);
    }

    importedRows.push({ title: titleCell, values });
  }

  const nonTitleHeaders = headerRow.filter((h) => h.toLowerCase() !== 'title');

  return {
    rows: importedRows,
    headers: nonTitleHeaders,
    rowCount: importedRows.length,
    warnings,
  };
}

/** Coerce a raw CSV string cell to the appropriate typed value. */
function coerceCsvCell(raw: string, column: ColumnDefinition | null): CellValue {
  const trimmed = raw.trim();

  if (!column) return trimmed || null;

  if (trimmed === '') return null;

  switch (column.type) {
    case 'number': {
      const n = parseFloat(trimmed);
      return Number.isNaN(n) ? null : n;
    }
    case 'checkbox': {
      const lower = trimmed.toLowerCase();
      if (['true', 'yes', '1', 'on', 'checked'].includes(lower)) return true;
      if (['false', 'no', '0', 'off', 'unchecked'].includes(lower)) return false;
      return null;
    }
    case 'multi_select': {
      // Accept both semicolon and comma-separated values
      const parts = trimmed.includes(';')
        ? trimmed
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      return parts.length > 0 ? parts : null;
    }
    case 'date': {
      // Validate it looks like a date; return as-is
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? trimmed : d.toISOString().split('T')[0];
    }
    case 'formula':
      // Formula columns are computed — skip on import
      return null;
    default:
      return trimmed;
  }
}

// ---------------------------------------------------------------------------
// Utility: generate a CSV filename
// ---------------------------------------------------------------------------

/**
 * Generate a safe CSV export filename from a database/view name.
 */
export function generateCsvFilename(name: string): string {
  const sanitised = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `${sanitised || 'database'}-${date}.csv`;
}

/**
 * Trigger a browser file download for a CSV string.
 * Safe to call only in browser environments.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
