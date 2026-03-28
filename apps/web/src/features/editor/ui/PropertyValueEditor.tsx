'use client';

/**
 * PropertyValueEditor.tsx
 *
 * Polymorphic inline value editor for frontmatter properties.
 * Renders the appropriate input widget based on the detected value type.
 *
 *   string  → single-line text input
 *   number  → number input
 *   boolean → toggle checkbox (switch-style)
 *   date    → date input (YYYY-MM-DD)
 *   array   → chip/tag input (handled by ArrayChipEditor)
 */

import { useState, useCallback, useRef } from 'react';
import type { FrontmatterProperty, FrontmatterValueType } from '../lib/frontmatter-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertyValueEditorProps {
  property: FrontmatterProperty;
  disabled?: boolean;
  onCommit: (value: FrontmatterProperty['value'], type: FrontmatterValueType) => void;
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------

const INPUT_BASE =
  'w-full rounded border border-sidebar-border bg-background-input px-1.5 py-0.5 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50';

// ---------------------------------------------------------------------------
// Array chip editor
// ---------------------------------------------------------------------------

interface ArrayChipEditorProps {
  items: string[];
  disabled?: boolean;
  onCommit: (items: string[]) => void;
}

function ArrayChipEditor({ items, disabled, onCommit }: ArrayChipEditorProps) {
  const [chips, setChips] = useState<string[]>(items);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes during render (no useEffect needed for derived state reset)
  const prevItemsRef = useRef(items);
  if (prevItemsRef.current !== items) {
    prevItemsRef.current = items;
    setChips(items);
  }

  const addChip = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || chips.includes(trimmed)) {
        setInputValue('');
        return;
      }
      const next = [...chips, trimmed];
      setChips(next);
      onCommit(next);
      setInputValue('');
    },
    [chips, onCommit],
  );

  const removeChip = useCallback(
    (index: number) => {
      const next = chips.filter((_, i) => i !== index);
      setChips(next);
      onCommit(next);
    },
    [chips, onCommit],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  }

  return (
    <div
      className="flex min-h-[28px] flex-wrap items-center gap-1 rounded border border-sidebar-border bg-background-input px-1.5 py-1 focus-within:ring-1 focus-within:ring-sidebar-ring cursor-text"
      onClick={() => inputRef.current?.focus()}
      role="listbox"
      aria-label="Array values"
    >
      {chips.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          role="option"
          aria-selected
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-px text-xs text-primary"
        >
          {chip}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeChip(i);
              }}
              aria-label={`Remove ${chip}`}
              className="flex h-3 w-3 items-center justify-center rounded-full hover:bg-primary/20 transition-colors duration-fast"
            >
              <svg viewBox="0 0 16 16" className="h-2 w-2" fill="currentColor" aria-hidden="true">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          )}
        </span>
      ))}

      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addChip(inputValue);
          }}
          placeholder={chips.length === 0 ? 'Add value...' : ''}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
          aria-label="New array item"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// String editor
// ---------------------------------------------------------------------------

interface StringEditorProps {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}

function StringEditor({ value, disabled, onCommit }: StringEditorProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  // Sync prop changes during render (no useEffect needed for prop-to-state sync)
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setDraft(value);
    committed.current = value;
  }

  function handleBlur() {
    if (draft !== committed.current) {
      committed.current = draft;
      onCommit(draft);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(committed.current);
    }
  }

  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={INPUT_BASE}
      aria-label="String value"
    />
  );
}

// ---------------------------------------------------------------------------
// Number editor
// ---------------------------------------------------------------------------

interface NumberEditorProps {
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

function NumberEditor({ value, disabled, onCommit }: NumberEditorProps) {
  const [draft, setDraft] = useState(String(value));
  const committed = useRef(String(value));

  // Sync prop changes during render (no useEffect needed for prop-to-state sync)
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setDraft(String(value));
    committed.current = String(value);
  }

  function handleBlur() {
    const num = Number(draft);
    if (!Number.isNaN(num) && draft !== committed.current) {
      committed.current = draft;
      onCommit(num);
    } else if (Number.isNaN(num)) {
      // Revert to last valid value
      setDraft(committed.current);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') setDraft(committed.current);
  }

  return (
    <input
      type="number"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={INPUT_BASE}
      aria-label="Number value"
    />
  );
}

// ---------------------------------------------------------------------------
// Boolean editor (toggle switch)
// ---------------------------------------------------------------------------

interface BooleanEditorProps {
  value: boolean;
  disabled?: boolean;
  onCommit: (value: boolean) => void;
}

function BooleanEditor({ value, disabled, onCommit }: BooleanEditorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onCommit(!value)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        value ? 'bg-primary' : 'bg-sidebar-border',
      ].join(' ')}
      aria-label="Boolean toggle"
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-fast',
          value ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Date editor
// ---------------------------------------------------------------------------

interface DateEditorProps {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}

function DateEditor({ value, disabled, onCommit }: DateEditorProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  // Sync prop changes during render (no useEffect needed for prop-to-state sync)
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setDraft(value);
    committed.current = value;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
  }

  function handleBlur() {
    if (draft !== committed.current) {
      committed.current = draft;
      onCommit(draft);
    }
  }

  return (
    <input
      type="date"
      value={draft}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      className={INPUT_BASE}
      aria-label="Date value"
    />
  );
}

// ---------------------------------------------------------------------------
// Main polymorphic component
// ---------------------------------------------------------------------------

export function PropertyValueEditor({ property, disabled, onCommit }: PropertyValueEditorProps) {
  switch (property.type) {
    case 'array':
      return (
        <ArrayChipEditor
          items={property.value as string[]}
          disabled={disabled}
          onCommit={(items) => onCommit(items, 'array')}
        />
      );

    case 'boolean':
      return (
        <BooleanEditor
          value={property.value as boolean}
          disabled={disabled}
          onCommit={(v) => onCommit(v, 'boolean')}
        />
      );

    case 'number':
      return (
        <NumberEditor
          value={property.value as number}
          disabled={disabled}
          onCommit={(v) => onCommit(v, 'number')}
        />
      );

    case 'date':
      return (
        <DateEditor
          value={property.value as string}
          disabled={disabled}
          onCommit={(v) => onCommit(v, 'date')}
        />
      );

    case 'string':
    default:
      return (
        <StringEditor
          value={String(property.value ?? '')}
          disabled={disabled}
          onCommit={(v) => onCommit(v, 'string')}
        />
      );
  }
}
