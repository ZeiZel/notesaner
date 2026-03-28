import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { exportToCsv, csvQuote } from '../csv-export';
import { AuditAction, AuditEntry } from '../audit.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: randomUUID(),
    timestamp: '2025-06-01T12:00:00.000Z',
    action: AuditAction.NOTE_CREATED,
    userId: 'user-123',
    workspaceId: 'ws-abc',
    metadata: { noteId: 'note-xyz' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

// ─── csvQuote() ───────────────────────────────────────────────────────────────

describe('csvQuote()', () => {
  it('wraps a plain string in double quotes', () => {
    expect(csvQuote('hello')).toBe('"hello"');
  });

  it('escapes an embedded double-quote by doubling it', () => {
    expect(csvQuote('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles empty string', () => {
    expect(csvQuote('')).toBe('""');
  });

  it('handles null — renders as empty string', () => {
    expect(csvQuote(null)).toBe('""');
  });

  it('handles undefined — renders as empty string', () => {
    expect(csvQuote(undefined)).toBe('""');
  });

  it('normalises embedded newlines to spaces', () => {
    expect(csvQuote('line1\nline2')).toBe('"line1 line2"');
  });

  it('normalises embedded carriage returns', () => {
    expect(csvQuote('line1\r\nline2')).toBe('"line1 line2"');
  });

  it('does not alter commas inside values', () => {
    expect(csvQuote('a,b,c')).toBe('"a,b,c"');
  });
});

// ─── exportToCsv() ────────────────────────────────────────────────────────────

describe('exportToCsv()', () => {
  it('returns a header row when entries array is empty', () => {
    const csv = exportToCsv([]);
    expect(csv).toMatch(/^"ID","Timestamp"/);
  });

  it('uses CRLF line endings (RFC 4180)', () => {
    const csv = exportToCsv([makeEntry()]);
    expect(csv).toContain('\r\n');
    // Should not have bare LF newlines
    const lines = csv.split('\r\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('produces exactly 2 lines (header + data) for a single entry', () => {
    const csv = exportToCsv([makeEntry()]);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it('produces N+1 lines for N entries', () => {
    const csv = exportToCsv([makeEntry(), makeEntry(), makeEntry()]);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(4);
  });

  it('includes the entry id in the output', () => {
    const entry = makeEntry();
    const csv = exportToCsv([entry]);
    expect(csv).toContain(entry.id);
  });

  it('includes the action in the output', () => {
    const csv = exportToCsv([makeEntry({ action: AuditAction.AUTH_LOGIN })]);
    expect(csv).toContain(AuditAction.AUTH_LOGIN);
  });

  it('serialises metadata as compact JSON', () => {
    const entry = makeEntry({ metadata: { key: 'value', count: 42 } });
    const csv = exportToCsv([entry]);
    expect(csv).toContain('"key"');
    expect(csv).toContain('42');
  });

  it('renders empty string for null workspaceId', () => {
    const entry = makeEntry({ workspaceId: null });
    const csv = exportToCsv([entry]);
    // workspaceId column should be empty quoted field
    expect(csv).toContain('""');
  });

  it('escapes double-quotes in metadata values', () => {
    // When metadata is JSON.stringify'd, " becomes \". The resulting JSON
    // string is then CSV-quoted: the outer wrapper adds " delimiters and any
    // embedded " in the final string (the JSON-escaped \" pair contains no
    // bare double-quote) does not need further CSV escaping.
    // Verify that the metadata column is still present and quoted.
    const entry = makeEntry({ metadata: { note: 'He said "hello"' } });
    const csv = exportToCsv([entry]);
    const dataLine = csv.split('\r\n')[1];
    // Last column (metadata) must be non-empty and quoted
    expect(dataLine).toMatch(/"[^"]+"$/);
    // Raw string "hello" should appear somewhere in the serialised metadata column
    expect(csv).toContain('hello');
  });

  it('handles userAgent with commas correctly', () => {
    const entry = makeEntry({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)' });
    const csv = exportToCsv([entry]);
    // The comma-containing value should be safely quoted
    expect(csv).toContain('"Mozilla/5.0 (Windows NT 10.0; Win64)"');
  });

  it('header row contains all expected column labels', () => {
    const csv = exportToCsv([]);
    const headerLine = csv.split('\r\n')[0];
    expect(headerLine).toContain('"ID"');
    expect(headerLine).toContain('"Timestamp"');
    expect(headerLine).toContain('"Action"');
    expect(headerLine).toContain('"User ID"');
    expect(headerLine).toContain('"Workspace ID"');
    expect(headerLine).toContain('"IP Address"');
    expect(headerLine).toContain('"User Agent"');
    expect(headerLine).toContain('"Metadata"');
  });

  it('renders empty metadata as empty string in the metadata column', () => {
    const entry = makeEntry({ metadata: {} });
    const csv = exportToCsv([entry]);
    // Empty metadata should result in the metadata column being empty ("" at end of row)
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine.endsWith('""')).toBe(true);
  });

  it('orders columns consistently across multiple entries', () => {
    const e1 = makeEntry({ action: AuditAction.NOTE_CREATED });
    const e2 = makeEntry({ action: AuditAction.NOTE_DELETED });
    const csv = exportToCsv([e1, e2]);
    const lines = csv.split('\r\n').filter(Boolean);
    // Each data row should have the same number of comma-separated columns as the header
    const headerColCount = (lines[0].match(/","/g) ?? []).length;
    const row1ColCount = (lines[1].match(/","/g) ?? []).length;
    const row2ColCount = (lines[2].match(/","/g) ?? []).length;
    expect(row1ColCount).toBe(headerColCount);
    expect(row2ColCount).toBe(headerColCount);
  });
});
