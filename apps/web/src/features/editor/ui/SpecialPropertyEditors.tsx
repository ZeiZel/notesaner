'use client';

/**
 * SpecialPropertyEditors.tsx
 *
 * Dedicated editor components for well-known frontmatter fields:
 *
 *   TitleEditor   — large single-line text input for the note title
 *   TagsEditor    — chip input with deduplication (mirrors TagPill in PropertiesPanel)
 *   AliasesEditor — list input for note aliases (alternate names/slugs)
 *
 * These replace the generic PropertyValueEditor for their respective keys
 * to provide a richer, semantically-appropriate editing experience.
 */

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TitleEditorProps {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}

export interface TagsEditorProps {
  tags: string[];
  /** Optional tag suggestions for autocomplete. */
  suggestions?: string[];
  disabled?: boolean;
  onCommit: (tags: string[]) => void;
}

export interface AliasesEditorProps {
  aliases: string[];
  disabled?: boolean;
  onCommit: (aliases: string[]) => void;
}

// ---------------------------------------------------------------------------
// TitleEditor
// ---------------------------------------------------------------------------

/**
 * Large single-line input for the `title` frontmatter field.
 * Commits on blur or Enter key.
 */
export function TitleEditor({ value, disabled, onCommit }: TitleEditorProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  // Sync external changes during render (no useEffect needed for prop-to-state sync)
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setDraft(value);
    committed.current = value;
  }

  function handleBlur() {
    const trimmed = draft.trim();
    if (trimmed !== committed.current) {
      committed.current = trimmed;
      onCommit(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') setDraft(committed.current);
  }

  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Note title..."
      className="w-full rounded border border-sidebar-border bg-background-input px-2 py-1 text-sm font-medium text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50"
      aria-label="Note title"
    />
  );
}

// ---------------------------------------------------------------------------
// Tag chip (shared between TagsEditor and AliasesEditor)
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
  /** Tailwind color classes for background and text. Defaults to primary. */
  colorClass?: string;
}

function Chip({ label, onRemove, disabled, colorClass = 'bg-primary/15 text-primary' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${colorClass}`}
    >
      {label}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/10 transition-colors duration-fast"
        >
          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TagsEditor
// ---------------------------------------------------------------------------

/**
 * Chip input for the `tags` frontmatter field.
 *
 * Features:
 *   - Comma or Enter to add a tag
 *   - Backspace removes the last chip when input is empty
 *   - Deduplication (case-insensitive, leading # stripped)
 *   - Optional suggestions dropdown for autocomplete
 */
export function TagsEditor({ tags, suggestions = [], disabled, onCommit }: TagsEditorProps) {
  const [chips, setChips] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes during render (no useEffect needed for prop-to-state sync)
  const prevTagsRef = useRef(tags);
  if (prevTagsRef.current !== tags) {
    prevTagsRef.current = tags;
    setChips(tags);
  }

  const normalizeTag = (raw: string) => raw.trim().toLowerCase().replace(/^#+/, '');

  const addTag = useCallback(
    (raw: string) => {
      const tag = normalizeTag(raw);
      if (!tag || chips.map(normalizeTag).includes(tag)) {
        setInputValue('');
        setShowSuggestions(false);
        return;
      }
      const next = [...chips, tag];
      setChips(next);
      onCommit(next);
      setInputValue('');
      setShowSuggestions(false);
    },
    [chips, onCommit],
  );

  const removeTag = useCallback(
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
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      removeTag(chips.length - 1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const filteredSuggestions = suggestions
    .filter((s) => {
      const norm = normalizeTag(s);
      return norm.includes(normalizeTag(inputValue)) && !chips.map(normalizeTag).includes(norm);
    })
    .slice(0, 8);

  return (
    <div className="space-y-1.5">
      {/* Chip display */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1" role="list" aria-label="Tags">
          {chips.map((tag, i) => (
            <div key={`${tag}-${i}`} role="listitem">
              <Chip label={tag} onRemove={() => removeTag(i)} disabled={disabled} />
            </div>
          ))}
        </div>
      )}

      {/* Input + suggestions */}
      {!disabled && (
        <div className="relative">
          <div
            className="flex items-center rounded border border-sidebar-border bg-background-input px-1.5 py-1 focus-within:ring-1 focus-within:ring-sidebar-ring"
            onClick={() => inputRef.current?.focus()}
          >
            <svg
              viewBox="0 0 16 16"
              className="mr-1 h-3 w-3 shrink-0 text-sidebar-muted"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25v5.025zM6 5a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay to allow suggestion click to register
                setTimeout(() => setShowSuggestions(false), 150);
              }}
              placeholder="Add tag..."
              className="min-w-[100px] flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
              aria-label="New tag"
              aria-expanded={showSuggestions && filteredSuggestions.length > 0}
              role="combobox"
              aria-autocomplete="list"
            />
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Tag suggestions"
              className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-40 overflow-y-auto rounded border border-sidebar-border bg-popover shadow-md"
            >
              {filteredSuggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(suggestion);
                    }}
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-foreground hover:bg-sidebar-accent transition-colors duration-fast"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3 shrink-0 text-sidebar-muted"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25v5.025zM6 5a1 1 0 100 2 1 1 0 000-2z" />
                    </svg>
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {chips.length === 0 && disabled && <p className="text-xs text-sidebar-muted">No tags</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AliasesEditor
// ---------------------------------------------------------------------------

/**
 * List input for the `aliases` frontmatter field.
 * Aliases are alternate note names used for wiki-link resolution.
 *
 * Features:
 *   - Enter to add an alias
 *   - Each alias shown as a removable chip (muted green color)
 *   - Deduplication
 */
export function AliasesEditor({ aliases, disabled, onCommit }: AliasesEditorProps) {
  const [items, setItems] = useState<string[]>(aliases);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes during render (no useEffect needed for prop-to-state sync)
  const prevAliasesRef = useRef(aliases);
  if (prevAliasesRef.current !== aliases) {
    prevAliasesRef.current = aliases;
    setItems(aliases);
  }

  const addAlias = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || items.includes(trimmed)) {
        setInputValue('');
        return;
      }
      const next = [...items, trimmed];
      setItems(next);
      onCommit(next);
      setInputValue('');
    },
    [items, onCommit],
  );

  const removeAlias = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      setItems(next);
      onCommit(next);
    },
    [items, onCommit],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAlias(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && items.length > 0) {
      removeAlias(items.length - 1);
    }
  }

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1" role="list" aria-label="Aliases">
          {items.map((alias, i) => (
            <div key={`${alias}-${i}`} role="listitem">
              <Chip
                label={alias}
                onRemove={() => removeAlias(i)}
                disabled={disabled}
                colorClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              />
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div
          className="flex items-center rounded border border-sidebar-border bg-background-input px-1.5 py-1 focus-within:ring-1 focus-within:ring-sidebar-ring cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <svg
            viewBox="0 0 16 16"
            className="mr-1 h-3 w-3 shrink-0 text-sidebar-muted"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7.5 1.5A5.5 5.5 0 1113 7h-1.5a4 4 0 10-3.5 5.98v1.52A5.5 5.5 0 117.5 1.5zm0 3.75a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addAlias(inputValue);
            }}
            placeholder="Add alias..."
            className="min-w-[100px] flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
            aria-label="New alias"
          />
        </div>
      )}

      {items.length === 0 && disabled && <p className="text-xs text-sidebar-muted">No aliases</p>}
    </div>
  );
}
