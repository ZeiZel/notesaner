'use client';

/**
 * SavedSearches — sidebar panel showing the user's saved and pinned search queries.
 *
 * Features:
 *   - Pinned searches displayed at the top with a pin icon
 *   - Unpinned searches sorted by most recently used
 *   - Recent search history section
 *   - Save current search, rename, delete, duplicate, and share actions
 *   - Inline rename via double-click on search name
 *   - Keyboard accessible (Tab, Enter, Escape)
 *
 * No useEffect for derived state — pinned/unpinned lists are computed during render.
 */

import { useState, useRef, useCallback } from 'react';
import { useSearchStore, type SavedSearch } from '@/shared/stores/search-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SavedSearchesProps {
  /** Called when a saved search is selected for execution */
  onExecuteSearch: (query: string) => void;
  /** Current search query (used to populate the "save" action) */
  currentQuery?: string;
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16,6 12,2 8,6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SavedSearchItem
// ---------------------------------------------------------------------------

function SavedSearchItem({
  search,
  onExecute,
  onTogglePin,
  onRemove,
  onDuplicate,
  onRename,
  onShare,
}: {
  search: SavedSearch;
  onExecute: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onShare: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(search.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = useCallback(() => {
    setEditName(search.name);
    setEditing(true);
    // Focus input after render
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [search.name]);

  const handleFinishEdit = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== search.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [editName, search.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinishEdit();
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [handleFinishEdit],
  );

  return (
    <div
      className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--ns-color-background-hover)]"
      role="listitem"
    >
      {/* Search icon / pin indicator */}
      <button
        type="button"
        onClick={onTogglePin}
        title={search.pinned ? 'Unpin search' : 'Pin search'}
        className="shrink-0 mt-0.5 transition-colors"
        style={{
          color: search.pinned ? 'var(--ns-color-primary)' : 'var(--ns-color-foreground-muted)',
        }}
        aria-label={search.pinned ? `Unpin ${search.name}` : `Pin ${search.name}`}
      >
        <PinIcon filled={search.pinned} />
      </button>

      {/* Name and query */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            className="w-full rounded px-1 py-0.5 text-sm"
            style={{
              backgroundColor: 'var(--ns-color-background-input)',
              border: '1px solid var(--ns-color-input)',
              color: 'var(--ns-color-foreground)',
            }}
            aria-label="Rename saved search"
          />
        ) : (
          <button
            type="button"
            onClick={onExecute}
            onDoubleClick={handleStartEdit}
            className="w-full text-left"
            title={`Run search: ${search.query}`}
          >
            <span
              className="block text-sm font-medium truncate"
              style={{ color: 'var(--ns-color-foreground)' }}
            >
              {search.name}
            </span>
            <span
              className="block text-xs truncate"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              {search.query}
            </span>
          </button>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate search"
          className="rounded p-1 transition-colors hover:bg-[var(--ns-color-background-active)]"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
          aria-label={`Duplicate ${search.name}`}
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onShare}
          title="Copy search query"
          className="rounded p-1 transition-colors hover:bg-[var(--ns-color-background-active)]"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
          aria-label={`Share ${search.name}`}
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Delete search"
          className="rounded p-1 transition-colors hover:bg-[var(--ns-color-destructive-muted)]"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
          aria-label={`Delete ${search.name}`}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavedSearches({ onExecuteSearch, currentQuery = '' }: SavedSearchesProps) {
  const savedSearches = useSearchStore((s) => s.savedSearches);
  const recentQueries = useSearchStore((s) => s.recentQueries);
  const saveSearch = useSearchStore((s) => s.saveSearch);
  const removeSavedSearch = useSearchStore((s) => s.removeSavedSearch);
  const updateSavedSearch = useSearchStore((s) => s.updateSavedSearch);
  const togglePin = useSearchStore((s) => s.togglePin);
  const markSearchUsed = useSearchStore((s) => s.markSearchUsed);
  const duplicateSavedSearch = useSearchStore((s) => s.duplicateSavedSearch);
  const removeRecentQuery = useSearchStore((s) => s.removeRecentQuery);
  const clearRecentQueries = useSearchStore((s) => s.clearRecentQueries);

  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Derive pinned and unpinned lists during render — no useEffect needed
  const pinnedSearches = savedSearches
    .filter((s) => s.pinned)
    .sort((a, b) => a.name.localeCompare(b.name));

  const unpinnedSearches = savedSearches
    .filter((s) => !s.pinned)
    .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());

  const handleSave = () => {
    const name = saveName.trim();
    const query = currentQuery.trim();
    if (!name || !query) return;
    saveSearch(name, query);
    setSaveName('');
    setShowSaveForm(false);
  };

  const handleExecute = (search: SavedSearch) => {
    markSearchUsed(search.id);
    onExecuteSearch(search.query);
  };

  const handleShare = async (search: SavedSearch) => {
    try {
      await navigator.clipboard.writeText(search.query);
      setShareToast(`Copied: ${search.name}`);
      setTimeout(() => setShareToast(null), 2000);
    } catch {
      // Fallback: do nothing if clipboard is unavailable
    }
  };

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Saved searches">
      {/* Header + save button */}
      <div className="flex items-center justify-between px-2">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Saved Searches
        </h3>
        {currentQuery.trim() && (
          <button
            type="button"
            onClick={() => setShowSaveForm(!showSaveForm)}
            className="text-xs rounded px-2 py-0.5 transition-colors"
            style={{
              backgroundColor: 'var(--ns-color-primary-muted)',
              color: 'var(--ns-color-primary)',
            }}
          >
            {showSaveForm ? 'Cancel' : 'Save current'}
          </button>
        )}
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="px-2 flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setShowSaveForm(false);
            }}
            placeholder="Search name..."
            className="flex-1 rounded-sm border px-2 py-1 text-sm"
            style={{
              backgroundColor: 'var(--ns-color-background-input)',
              borderColor: 'var(--ns-color-input)',
              color: 'var(--ns-color-foreground)',
            }}
            autoFocus
            aria-label="Name for saved search"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="rounded-sm px-2 py-1 text-sm disabled:opacity-50"
            style={{
              backgroundColor: 'var(--ns-color-primary)',
              color: 'var(--ns-color-primary-foreground)',
            }}
          >
            Save
          </button>
        </div>
      )}

      {/* Toast */}
      {shareToast && (
        <div
          className="mx-2 rounded-md px-2 py-1 text-xs text-center"
          style={{
            backgroundColor: 'var(--ns-color-success-muted)',
            color: 'var(--ns-color-success)',
          }}
          role="status"
          aria-live="polite"
        >
          {shareToast}
        </div>
      )}

      {/* Pinned searches */}
      {pinnedSearches.length > 0 && (
        <div role="list" aria-label="Pinned searches">
          <p
            className="px-2 text-[10px] font-medium uppercase tracking-wider mb-1"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Pinned
          </p>
          {pinnedSearches.map((search) => (
            <SavedSearchItem
              key={search.id}
              search={search}
              onExecute={() => handleExecute(search)}
              onTogglePin={() => togglePin(search.id)}
              onRemove={() => removeSavedSearch(search.id)}
              onDuplicate={() => duplicateSavedSearch(search.id)}
              onRename={(name) => updateSavedSearch(search.id, { name })}
              onShare={() => handleShare(search)}
            />
          ))}
        </div>
      )}

      {/* Unpinned searches */}
      {unpinnedSearches.length > 0 && (
        <div role="list" aria-label="Saved searches list">
          {pinnedSearches.length > 0 && (
            <p
              className="px-2 text-[10px] font-medium uppercase tracking-wider mb-1"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              All
            </p>
          )}
          {unpinnedSearches.map((search) => (
            <SavedSearchItem
              key={search.id}
              search={search}
              onExecute={() => handleExecute(search)}
              onTogglePin={() => togglePin(search.id)}
              onRemove={() => removeSavedSearch(search.id)}
              onDuplicate={() => duplicateSavedSearch(search.id)}
              onRename={(name) => updateSavedSearch(search.id, { name })}
              onShare={() => handleShare(search)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {savedSearches.length === 0 && (
        <p className="px-2 text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          No saved searches yet. Run a search and save it for quick access.
        </p>
      )}

      {/* Recent searches */}
      {recentQueries.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <p
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              Recent
            </p>
            <button
              type="button"
              onClick={clearRecentQueries}
              className="text-[10px]"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              Clear
            </button>
          </div>
          <div role="list" aria-label="Recent searches">
            {recentQueries.slice(0, 8).map((query) => (
              <div
                key={query}
                className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[var(--ns-color-background-hover)]"
                role="listitem"
              >
                <span style={{ color: 'var(--ns-color-foreground-muted)' }}>
                  <ClockIcon />
                </span>
                <button
                  type="button"
                  onClick={() => onExecuteSearch(query)}
                  className="flex-1 text-left text-xs truncate"
                  style={{ color: 'var(--ns-color-foreground-secondary)' }}
                  title={query}
                >
                  {query}
                </button>
                <button
                  type="button"
                  onClick={() => removeRecentQuery(query)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5"
                  style={{ color: 'var(--ns-color-foreground-muted)' }}
                  aria-label={`Remove "${query}" from recent searches`}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path
                      d="M2 2l6 6M8 2l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
