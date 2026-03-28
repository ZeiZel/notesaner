'use client';

/**
 * CellRenderer.tsx — Renders a single database cell by column type.
 *
 * Supports both read mode (compact display) and edit mode (inline input).
 * The parent (TableView / other views) controls which cell is in edit mode
 * via the `isEditing` prop and calls `onCommit` / `onCancel` accordingly.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ColumnDefinition, CellValue, SelectOption } from './database-schema';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CellRendererProps {
  column: ColumnDefinition;
  value: CellValue;
  isEditing: boolean;
  onCommit: (value: CellValue) => void;
  onCancel: () => void;
  onStartEdit: () => void;
  /** Additional className for the cell container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: Select badge
// ---------------------------------------------------------------------------

function SelectBadge({ option }: { option: SelectOption }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: option.color ? `${option.color}25` : 'rgb(var(--muted) / 0.3)',
        color: option.color ?? 'inherit',
        border: `1px solid ${option.color ?? 'transparent'}`,
      }}
    >
      {option.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Read-mode renderers per type
// ---------------------------------------------------------------------------

function ReadText({ value }: { value: CellValue }) {
  const str = value === null || value === undefined ? '' : String(value);
  return (
    <span className="truncate text-sm text-foreground" title={str}>
      {str || <span className="text-muted-foreground/50">—</span>}
    </span>
  );
}

function ReadNumber({ value, column }: { value: CellValue; column: ColumnDefinition }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }
  const opts = column.options as
    | { format?: string; currencyCode?: string; decimalPlaces?: number }
    | undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return <span className="text-sm text-destructive">{String(value)}</span>;

  let formatted: string;
  if (opts?.format === 'percent') {
    formatted = `${(n * 100).toFixed(opts.decimalPlaces ?? 1)}%`;
  } else if (opts?.format === 'currency') {
    formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: opts.currencyCode ?? 'USD',
      minimumFractionDigits: opts.decimalPlaces ?? 2,
    }).format(n);
  } else {
    formatted = opts?.decimalPlaces !== undefined ? n.toFixed(opts.decimalPlaces) : n.toString();
  }
  return <span className="text-sm tabular-nums text-foreground">{formatted}</span>;
}

function ReadDate({ value, column }: { value: CellValue; column: ColumnDefinition }) {
  if (!value) return <span className="text-sm text-muted-foreground/50">—</span>;
  const opts = column.options as { includeTime?: boolean } | undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return <span className="text-sm text-destructive">{String(value)}</span>;
  }
  const formatted = opts?.includeTime ? d.toLocaleString() : d.toLocaleDateString();
  return <span className="text-sm text-foreground">{formatted}</span>;
}

function ReadSelect({ value, column }: { value: CellValue; column: ColumnDefinition }) {
  const opts = column.options as { options?: SelectOption[] } | undefined;
  const selectOptions = opts?.options ?? [];

  if (!value) return <span className="text-sm text-muted-foreground/50">—</span>;

  const option = selectOptions.find((o) => o.id === value || o.label === value);
  if (!option) return <span className="text-sm text-foreground">{String(value)}</span>;
  return <SelectBadge option={option} />;
}

function ReadMultiSelect({ value, column }: { value: CellValue; column: ColumnDefinition }) {
  const opts = column.options as { options?: SelectOption[] } | undefined;
  const selectOptions = opts?.options ?? [];

  const values = Array.isArray(value) ? value : [];
  if (values.length === 0) return <span className="text-sm text-muted-foreground/50">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => {
        const option = selectOptions.find((o) => o.id === v || o.label === v);
        return option ? (
          <SelectBadge key={v} option={option} />
        ) : (
          <span key={v} className="text-xs text-foreground">
            {v}
          </span>
        );
      })}
    </div>
  );
}

function ReadCheckbox({ value }: { value: CellValue }) {
  return (
    <span
      className={[
        'inline-flex h-4 w-4 items-center justify-center rounded border',
        value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
      ].join(' ')}
      aria-checked={Boolean(value)}
      role="checkbox"
    >
      {value && (
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="2,6 5,9 10,3" />
        </svg>
      )}
    </span>
  );
}

function ReadUrl({ value }: { value: CellValue }) {
  if (!value) return <span className="text-sm text-muted-foreground/50">—</span>;
  const str = String(value);
  return (
    <a
      href={str}
      target="_blank"
      rel="noopener noreferrer"
      className="truncate text-sm text-primary underline underline-offset-2 hover:opacity-80"
      onClick={(e) => e.stopPropagation()}
      title={str}
    >
      {str}
    </a>
  );
}

function ReadEmail({ value }: { value: CellValue }) {
  if (!value) return <span className="text-sm text-muted-foreground/50">—</span>;
  return (
    <a
      href={`mailto:${value}`}
      className="truncate text-sm text-primary underline underline-offset-2 hover:opacity-80"
      onClick={(e) => e.stopPropagation()}
    >
      {String(value)}
    </a>
  );
}

function ReadFile({ value }: { value: CellValue }) {
  const files = Array.isArray(value) ? value : value ? [String(value)] : [];
  if (files.length === 0) return <span className="text-sm text-muted-foreground/50">—</span>;
  return (
    <span className="text-sm text-foreground">
      {files.length === 1 ? files[0] : `${files.length} files`}
    </span>
  );
}

function ReadRelation({ value }: { value: CellValue }) {
  const ids = Array.isArray(value) ? value : value ? [String(value)] : [];
  if (ids.length === 0) return <span className="text-sm text-muted-foreground/50">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center rounded bg-accent px-1.5 py-0.5 text-xs">
          {id}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit-mode inputs per type
// ---------------------------------------------------------------------------

function EditText({
  value,
  onCommit,
  onCancel,
}: {
  value: CellValue;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(local);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(local)}
      className="h-full w-full bg-transparent px-1 text-sm outline-none ring-1 ring-primary/50"
    />
  );
}

function EditNumber({
  value,
  onCommit,
  onCancel,
}: {
  value: CellValue;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    const n = parseFloat(local);
    onCommit(Number.isNaN(n) ? null : n);
  }, [local, onCommit]);

  return (
    <input
      ref={ref}
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={commit}
      className="h-full w-full bg-transparent px-1 text-right text-sm tabular-nums outline-none ring-1 ring-primary/50"
    />
  );
}

function EditDate({
  value,
  onCommit,
  onCancel,
  column,
}: {
  value: CellValue;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
  column: ColumnDefinition;
}) {
  const opts = column.options as { includeTime?: boolean } | undefined;
  const ref = useRef<HTMLInputElement>(null);

  const raw = value ? String(value) : '';
  const [local, setLocal] = useState(() => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return opts?.includeTime ? d.toISOString().slice(0, 16) : d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      type={opts?.includeTime ? 'datetime-local' : 'date'}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(local || null);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(local || null)}
      className="h-full w-full bg-transparent px-1 text-sm outline-none ring-1 ring-primary/50"
    />
  );
}

function EditCheckbox({ value, onCommit }: { value: CellValue; onCommit: (v: CellValue) => void }) {
  return (
    <button
      type="button"
      className="flex h-full w-full items-center justify-center"
      onClick={() => onCommit(!value)}
      aria-label="Toggle checkbox"
    >
      <ReadCheckbox value={!value} />
    </button>
  );
}

function EditSelect({
  value,
  column,
  onCommit,
  onCancel,
}: {
  value: CellValue;
  column: ColumnDefinition;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const opts = column.options as { options?: SelectOption[] } | undefined;
  const selectOptions = opts?.options ?? [];
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <select
      ref={ref}
      value={String(value ?? '')}
      onChange={(e) => onCommit(e.target.value || null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCancel()}
      className="h-full w-full bg-background px-1 text-sm outline-none ring-1 ring-primary/50"
    >
      <option value="">—</option>
      {selectOptions.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EditUrl({
  value,
  onCommit,
  onCancel,
}: {
  value: CellValue;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      type="url"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(local || null);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(local || null)}
      placeholder="https://"
      className="h-full w-full bg-transparent px-1 text-sm outline-none ring-1 ring-primary/50"
    />
  );
}

function EditEmail({
  value,
  onCommit,
  onCancel,
}: {
  value: CellValue;
  onCommit: (v: CellValue) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      type="email"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(local || null);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(local || null)}
      placeholder="user@example.com"
      className="h-full w-full bg-transparent px-1 text-sm outline-none ring-1 ring-primary/50"
    />
  );
}

// ---------------------------------------------------------------------------
// Main CellRenderer
// ---------------------------------------------------------------------------

export function CellRenderer({
  column,
  value,
  isEditing,
  onCommit,
  onCancel,
  onStartEdit,
  className,
}: CellRendererProps) {
  const baseClass = [
    'relative flex h-full min-h-[32px] w-full items-center overflow-hidden px-2',
    isEditing ? 'p-0' : 'cursor-pointer',
    className ?? '',
  ].join(' ');

  // Checkbox toggles directly on click without entering "edit mode"
  if (column.type === 'checkbox') {
    return (
      <div className={baseClass} onClick={() => onCommit(!value)} role="button" tabIndex={0}>
        {isEditing ? (
          <EditCheckbox value={value} onCommit={onCommit} />
        ) : (
          <ReadCheckbox value={value} />
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={baseClass}>
        {column.type === 'text' && (
          <EditText value={value} onCommit={onCommit} onCancel={onCancel} />
        )}
        {column.type === 'number' && (
          <EditNumber value={value} onCommit={onCommit} onCancel={onCancel} />
        )}
        {column.type === 'date' && (
          <EditDate value={value} column={column} onCommit={onCommit} onCancel={onCancel} />
        )}
        {column.type === 'select' && (
          <EditSelect value={value} column={column} onCommit={onCommit} onCancel={onCancel} />
        )}
        {column.type === 'url' && <EditUrl value={value} onCommit={onCommit} onCancel={onCancel} />}
        {column.type === 'email' && (
          <EditEmail value={value} onCommit={onCommit} onCancel={onCancel} />
        )}
        {/* multi_select, relation, formula, file — fall back to text edit */}
        {['multi_select', 'relation', 'file', 'formula'].includes(column.type) && (
          <EditText
            value={Array.isArray(value) ? value.join(', ') : value}
            onCommit={(v) => {
              if (column.type === 'multi_select' || column.type === 'relation') {
                const parts = String(v ?? '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                onCommit(parts.length > 0 ? parts : null);
              } else {
                onCommit(v);
              }
            }}
            onCancel={onCancel}
          />
        )}
      </div>
    );
  }

  return (
    <div className={baseClass} onDoubleClick={onStartEdit}>
      {column.type === 'text' && <ReadText value={value} />}
      {column.type === 'number' && <ReadNumber value={value} column={column} />}
      {column.type === 'date' && <ReadDate value={value} column={column} />}
      {column.type === 'select' && <ReadSelect value={value} column={column} />}
      {column.type === 'multi_select' && <ReadMultiSelect value={value} column={column} />}
      {column.type === 'checkbox' && <ReadCheckbox value={value} />}
      {column.type === 'url' && <ReadUrl value={value} />}
      {column.type === 'email' && <ReadEmail value={value} />}
      {column.type === 'file' && <ReadFile value={value} />}
      {column.type === 'relation' && <ReadRelation value={value} />}
      {column.type === 'formula' && <ReadText value={value} />}
    </div>
  );
}
