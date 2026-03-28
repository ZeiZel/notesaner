'use client';

/**
 * PropertiesPanel.tsx
 *
 * Right-sidebar panel for viewing and editing note frontmatter properties.
 *
 * Layout (top to bottom):
 *   1. Info section   — read-only note metadata (path, word count, dates)
 *   2. Special props  — title, tags, aliases, date, description (dedicated editors)
 *   3. Custom props   — all other frontmatter key-value pairs
 *   4. Add property   — input to add new frontmatter key
 *   5. Visibility     — published toggle
 *
 * The component reads from useFrontmatterStore for editable frontmatter,
 * and from the NoteDto prop for immutable metadata.
 *
 * Saving strategy:
 *   - Changes in frontmatter-store are accumulated (isDirty flag)
 *   - On "Save properties" or note-level save, caller provides updated content
 *     by calling serializeToYaml() from the store
 *   - The panel calls onNoteUpdate with the relevant UpdateNoteDto fields
 */

import { useState, useCallback, useTransition, useEffect } from 'react';
import { useAuthStore } from '@/shared/stores/auth-store';
import { notesApi } from '@/shared/api/notes';
import {
  useFrontmatterStore,
  SPECIAL_KEYS,
  PropertyValueEditor,
  TitleEditor,
  TagsEditor,
  AliasesEditor,
  type FrontmatterProperty,
  type FrontmatterValueType,
} from '@/features/editor';
import type { NoteDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertiesPanelProps {
  note: NoteDto;
  workspaceId: string;
  /** Raw markdown content of the note (used to hydrate frontmatter store). */
  noteContent?: string;
  onNoteUpdate?: (updated: NoteDto) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatWordCount(count: number): string {
  if (count === 1) return '1 word';
  return `${count.toLocaleString()} words`;
}

// ---------------------------------------------------------------------------
// Read-only metadata row
// ---------------------------------------------------------------------------

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors duration-fast">
      <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
        {label}
      </span>
      <span className="break-all text-xs text-sidebar-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property row — wraps PropertyValueEditor with label + delete button
// ---------------------------------------------------------------------------

interface PropertyRowProps {
  property: FrontmatterProperty;
  disabled?: boolean;
  onCommit: (key: string, value: FrontmatterProperty['value'], type: FrontmatterValueType) => void;
  onDelete: (key: string) => void;
}

function PropertyRow({ property, disabled, onCommit, onDelete }: PropertyRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors duration-fast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Key label */}
      <span
        className="mt-1 w-24 shrink-0 truncate text-2xs font-medium uppercase tracking-wider text-sidebar-muted"
        title={property.key}
      >
        {property.key}
      </span>

      {/* Value editor */}
      <div className="min-w-0 flex-1">
        <PropertyValueEditor
          property={property}
          disabled={disabled}
          onCommit={(value, type) => onCommit(property.key, value, type)}
        />
      </div>

      {/* Delete button (visible on hover) */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onDelete(property.key)}
          aria-label={`Delete property ${property.key}`}
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-sidebar-muted hover:text-destructive hover:bg-destructive/10 transition-colors duration-fast',
            hovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 011.492.149l-.66 6.6A1.748 1.748 0 0111.595 15h-5.19a1.75 1.75 0 01-1.741-1.575l-.66-6.6a.75.75 0 011.492-.15z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add property row
// ---------------------------------------------------------------------------

interface AddPropertyRowProps {
  onAdd: (key: string) => void;
  existingKeys: Set<string>;
}

function AddPropertyRow({ onAdd, existingKeys }: AddPropertyRowProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

  function handleAdd() {
    const key = inputValue.trim();
    if (!key) return;

    if (!KEY_RE.test(key)) {
      setError(
        'Key must start with a letter or underscore and contain only letters, numbers, _, -',
      );
      return;
    }

    if (existingKeys.has(key)) {
      setError(`Property "${key}" already exists`);
      return;
    }

    onAdd(key);
    setInputValue('');
    setError(null);
    setExpanded(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setExpanded(false);
      setInputValue('');
      setError(null);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-sidebar-muted hover:text-foreground hover:bg-sidebar-accent transition-colors duration-fast"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
        </svg>
        Add property
      </button>
    );
  }

  return (
    <div className="space-y-1 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={inputValue}
          autoFocus
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="property_name"
          className="flex-1 rounded border border-sidebar-border bg-background-input px-1.5 py-0.5 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          aria-label="New property key"
          aria-describedby={error ? 'prop-key-error' : undefined}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="flex h-6 items-center gap-1 rounded bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40 transition-colors duration-fast"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setInputValue('');
            setError(null);
          }}
          aria-label="Cancel"
          className="flex h-6 w-6 items-center justify-center rounded text-sidebar-muted hover:bg-sidebar-accent transition-colors duration-fast"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
      {error && (
        <p id="prop-key-error" className="text-2xs text-destructive leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section (shared)
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm px-1 py-0.5 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-fast select-none">
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 shrink-0 rotate-0 transition-transform duration-fast group-open:rotate-90"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
        </svg>
        {title}
      </summary>
      <div className="mt-0.5 space-y-0">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Dirty indicator / save bar
// ---------------------------------------------------------------------------

interface SaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

function SaveBar({ isDirty, isSaving, onSave, onDiscard }: SaveBarProps) {
  if (!isDirty) return null;

  return (
    <div className="flex items-center justify-between rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5">
      <span className="text-2xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="rounded px-2 py-0.5 text-2xs text-sidebar-muted hover:bg-sidebar-accent transition-colors duration-fast disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded bg-primary px-2 py-0.5 text-2xs text-primary-foreground hover:bg-primary/90 transition-colors duration-fast disabled:opacity-40"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PropertiesPanel({
  note,
  workspaceId,
  noteContent = '',
  onNoteUpdate,
}: PropertiesPanelProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [isPending, startTransition] = useTransition();

  // Frontmatter store
  const {
    properties,
    isDirty,
    activeNoteId,
    parseFromYaml,
    setPropertyTyped,
    addProperty,
    removeProperty,
    markClean,
    reset,
    serializeToYaml,
  } = useFrontmatterStore();

  // Effect: hydrate Zustand frontmatter store when the active note changes.
  // This synchronizes external data (note content) into the store --
  // a valid side effect because parseFromYaml has side effects on the store.
  useEffect(() => {
    if (note.id !== activeNoteId || noteContent) {
      // Build a synthetic markdown block if we don't have full content
      // by serializing existing frontmatter from NoteDto
      const markdown = noteContent || buildFrontmatterFromDto(note);
      parseFromYaml(markdown, note.id);
    }
    return () => {
      reset();
    };
  }, [note.id, noteContent]);

  // Extract well-known props
  const titleProp = properties.get('title');
  const tagsProp = properties.get('tags');
  const aliasesProp = properties.get('aliases');
  const descriptionProp = properties.get('description');
  const dateProp = properties.get('date');

  const tagsValue = Array.isArray(tagsProp?.value) ? (tagsProp.value as string[]) : [];
  const aliasesValue = Array.isArray(aliasesProp?.value) ? (aliasesProp.value as string[]) : [];

  // Custom properties (excludes special keys)
  const customProperties = Array.from(properties.values()).filter((p) => !SPECIAL_KEYS.has(p.key));

  const existingKeys = new Set(properties.keys());

  // ---- Save handler ----

  function handleSave() {
    if (!accessToken || !isDirty) return;

    const yamlBlock = serializeToYaml();
    const tags = tagsValue;
    const title = titleProp?.value as string | undefined;

    startTransition(async () => {
      const updated = await notesApi.update(accessToken, workspaceId, note.id, {
        ...(title ? { title } : {}),
        tags,
        // content would be updated here if we had full note content integration
        // For now we only persist known fields via UpdateNoteDto
        // Full frontmatter write requires backend PATCH /notes/:id/frontmatter
      });
      markClean();
      onNoteUpdate?.(updated);
      void yamlBlock; // Available for future full-content write
    });
  }

  function handleDiscard() {
    const markdown = noteContent || buildFrontmatterFromDto(note);
    parseFromYaml(markdown, note.id);
  }

  function handleTogglePublished() {
    if (!accessToken) return;
    startTransition(async () => {
      const updated = await notesApi.update(accessToken, workspaceId, note.id, {
        isPublished: !note.isPublished,
      });
      onNoteUpdate?.(updated);
    });
  }

  const handlePropertyCommit = useCallback(
    (key: string, value: FrontmatterProperty['value'], type: FrontmatterValueType) => {
      setPropertyTyped(key, value, type);
    },
    [setPropertyTyped],
  );

  const handlePropertyDelete = useCallback(
    (key: string) => {
      removeProperty(key);
    },
    [removeProperty],
  );

  return (
    <div className="space-y-3">
      {/* Unsaved changes bar */}
      <SaveBar
        isDirty={isDirty}
        isSaving={isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* Section: Metadata (read-only) */}
      <Section title="Info">
        <MetaRow label="Path" value={note.path} />
        <MetaRow label="Words" value={formatWordCount(note.wordCount)} />
        <MetaRow label="Created" value={formatDate(note.createdAt)} />
        <MetaRow label="Updated" value={formatDate(note.updatedAt)} />
      </Section>

      {/* Section: Special properties */}
      <Section title="Properties">
        {/* Title */}
        <div className="space-y-0.5 px-2 py-1.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
            Title
          </span>
          <TitleEditor
            value={titleProp ? String(titleProp.value) : note.title}
            disabled={isPending}
            onCommit={(v) => setPropertyTyped('title', v, 'string')}
          />
        </div>

        {/* Description */}
        {descriptionProp && (
          <div className="space-y-0.5 px-2 py-1.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
              Description
            </span>
            <PropertyValueEditor
              property={descriptionProp}
              disabled={isPending}
              onCommit={(v, t) => setPropertyTyped('description', v, t)}
            />
          </div>
        )}

        {/* Date */}
        {dateProp && (
          <div className="space-y-0.5 px-2 py-1.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
              Date
            </span>
            <PropertyValueEditor
              property={dateProp}
              disabled={isPending}
              onCommit={(v, t) => setPropertyTyped('date', v, t)}
            />
          </div>
        )}

        {/* Tags */}
        <div className="space-y-0.5 px-2 py-1.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
            Tags
          </span>
          <TagsEditor
            tags={tagsValue}
            disabled={isPending}
            onCommit={(tags) => setPropertyTyped('tags', tags, 'array')}
          />
        </div>

        {/* Aliases */}
        <div className="space-y-0.5 px-2 py-1.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
            Aliases
          </span>
          <AliasesEditor
            aliases={aliasesValue}
            disabled={isPending}
            onCommit={(aliases) => setPropertyTyped('aliases', aliases, 'array')}
          />
        </div>
      </Section>

      {/* Section: Custom frontmatter */}
      {customProperties.length > 0 && (
        <Section title="Custom">
          {customProperties.map((prop) => (
            <PropertyRow
              key={prop.key}
              property={prop}
              disabled={isPending}
              onCommit={handlePropertyCommit}
              onDelete={handlePropertyDelete}
            />
          ))}
        </Section>
      )}

      {/* Add property row */}
      <div className="border-t border-sidebar-border pt-1">
        <AddPropertyRow onAdd={(key) => addProperty(key)} existingKeys={existingKeys} />
      </div>

      {/* Section: Visibility */}
      <Section title="Visibility">
        <div className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors duration-fast">
          <span className="text-xs text-sidebar-foreground">Published</span>
          <button
            type="button"
            role="switch"
            aria-checked={note.isPublished}
            disabled={isPending}
            onClick={handleTogglePublished}
            className={[
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              note.isPublished ? 'bg-primary' : 'bg-sidebar-border',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-fast',
                note.isPublished ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: build a synthetic frontmatter markdown block from NoteDto
// (used when noteContent is not yet loaded)
// ---------------------------------------------------------------------------

function buildFrontmatterFromDto(note: NoteDto): string {
  const lines: string[] = ['---'];

  lines.push(`title: "${note.title.replace(/"/g, '\\"')}"`);

  const tags = Array.isArray(note.frontmatter?.tags)
    ? (note.frontmatter.tags as unknown[]).map(String)
    : [];

  if (tags.length > 0) {
    if (tags.length === 1) {
      lines.push(`tags: [${tags[0]}]`);
    } else {
      lines.push('tags:');
      for (const tag of tags) {
        lines.push(`  - ${tag}`);
      }
    }
  }

  // Include remaining frontmatter fields
  for (const [key, value] of Object.entries(note.frontmatter ?? {})) {
    if (key === 'title' || key === 'tags') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.length === 1) {
        lines.push(`${key}: [${String(value[0])}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${String(item)}`);
        }
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${String(value ?? '').replace(/"/g, '\\"')}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}
