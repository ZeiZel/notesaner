import type { AuditEntry } from './audit.types';

// ─── CSV column order ─────────────────────────────────────────────────────────

const HEADERS: ReadonlyArray<keyof AuditEntry | 'metadataJson'> = [
  'id',
  'timestamp',
  'action',
  'userId',
  'workspaceId',
  'ipAddress',
  'userAgent',
  'metadataJson',
];

const HEADER_LABELS: Record<(typeof HEADERS)[number], string> = {
  id: 'ID',
  timestamp: 'Timestamp',
  action: 'Action',
  userId: 'User ID',
  workspaceId: 'Workspace ID',
  metadata: 'Metadata (raw)',
  ipAddress: 'IP Address',
  userAgent: 'User Agent',
  metadataJson: 'Metadata',
};

// ─── Core export function ────────────────────────────────────────────────────

/**
 * Converts an array of AuditEntry objects to an RFC-4180-compliant CSV string.
 *
 * Rules:
 *   - All fields are quoted with double-quotes.
 *   - Double-quotes inside values are escaped by doubling them ("").
 *   - Newlines inside values are replaced with a space so every row is
 *     guaranteed to occupy a single line.
 *   - Null / undefined values are rendered as empty strings.
 *   - The `metadata` object is serialised as compact JSON in the last column.
 *
 * @param entries  Audit-log entries to export. May be empty.
 * @returns        UTF-8 CSV string beginning with a header row.
 */
export function exportToCsv(entries: AuditEntry[]): string {
  const rows: string[] = [buildHeaderRow()];

  for (const entry of entries) {
    rows.push(buildDataRow(entry));
  }

  // CRLF line endings per RFC 4180
  return rows.join('\r\n');
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function buildHeaderRow(): string {
  return HEADERS.map((col) => csvQuote(HEADER_LABELS[col])).join(',');
}

function buildDataRow(entry: AuditEntry): string {
  const metadataJson =
    entry.metadata && Object.keys(entry.metadata).length > 0 ? JSON.stringify(entry.metadata) : '';

  const values: string[] = [
    entry.id ?? '',
    entry.timestamp ?? '',
    entry.action ?? '',
    entry.userId ?? '',
    entry.workspaceId ?? '',
    entry.ipAddress ?? '',
    entry.userAgent ?? '',
    metadataJson,
  ];

  return values.map(csvQuote).join(',');
}

/**
 * Wraps a value in CSV double-quote delimiters, escaping internal
 * double-quotes (RFC 4180 §2.7) and normalising embedded newlines.
 */
export function csvQuote(value: string | null | undefined): string {
  const str = value == null ? '' : String(value);
  // Replace embedded newlines/carriage returns with a space
  const normalised = str.replace(/[\r\n]+/g, ' ');
  // Escape double-quotes by doubling them
  const escaped = normalised.replace(/"/g, '""');
  return `"${escaped}"`;
}
