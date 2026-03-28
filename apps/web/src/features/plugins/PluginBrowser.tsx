'use client';

/**
 * PluginBrowser
 *
 * Main plugin discovery UI — the "Plugin Browser" page in Settings.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Search bar                        Sort dropdown             │
 *   ├──────────────────┬───────────────────────────────────────────┤
 *   │  Tag filter      │  Plugin grid (cards)                      │
 *   │  sidebar         │                                           │
 *   │                  │  Load more (infinite scroll sentinel)     │
 *   └──────────────────┴───────────────────────────────────────────┘
 *
 * State management:
 *   - All state lives in usePluginBrowserStore.
 *   - On mount, triggers the initial search.
 *   - Filter changes re-trigger search (debounced for query text).
 *   - Install/uninstall delegate to the store.
 *
 * No useEffect for derived state — only for:
 *   1. Initial search fetch on mount
 *   2. IntersectionObserver for infinite scroll sentinel
 *   3. Debounce timer for query input
 */

import * as React from 'react';
import { Input } from '@notesaner/ui';
import { Button } from '@notesaner/ui';
import { Badge } from '@notesaner/ui';
import { Skeleton } from '@notesaner/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@notesaner/ui';
import { PluginCard } from './PluginCard';
import { PluginDetailModal } from './PluginDetailModal';
import { usePluginBrowserStore, selectBrowserPluginOp } from './plugin-browser-store';
import type { RegistryPlugin } from './plugin-registry-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginBrowserProps {
  /** Access token forwarded from the session — required for API calls. */
  accessToken: string;
  /** Current workspace ID — required for install/uninstall operations. */
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Loading skeleton grid
// ---------------------------------------------------------------------------

function PluginGridSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tag filter sidebar
// ---------------------------------------------------------------------------

interface TagFilterSidebarProps {
  availableTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

function TagFilterSidebar({
  availableTags,
  selectedTags,
  onToggle,
  onClear,
}: TagFilterSidebarProps) {
  return (
    <aside className="w-48 shrink-0 flex flex-col gap-2" aria-label="Filter plugins by tag">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
          Tags
        </span>
        {selectedTags.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
            aria-label="Clear all tag filters"
          >
            Clear
          </button>
        )}
      </div>

      {availableTags.length === 0 ? (
        <p className="text-xs text-foreground-muted">No tags available.</p>
      ) : (
        <ul className="flex flex-col gap-0.5" role="list">
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => onToggle(tag)}
                  aria-pressed={active}
                  className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    active
                      ? 'bg-primary-muted text-primary font-medium'
                      : 'text-foreground-secondary hover:bg-background-hover hover:text-foreground'
                  }`}
                >
                  {tag}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sort control
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'stars', label: 'Most popular' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PluginBrowser({ accessToken, workspaceId }: PluginBrowserProps) {
  const store = usePluginBrowserStore();
  const {
    query,
    selectedTags,
    sortBy,
    plugins,
    total,
    cursor,
    searchStatus,
    searchError,
    availableTags,
    detailPlugin,
    detailStatus,
    detailError,
    operations,
    installedPluginIds,
    setQuery,
    toggleTag,
    clearTags,
    setSortBy,
    search,
    loadMore,
    openDetail,
    closeDetail,
    installPlugin,
    uninstallPlugin,
  } = store;

  // ---- Debounced query search ----
  // Store debounce ref so we can cancel on cleanup. This is a valid useEffect
  // because it manages a timer side-effect, not derived state.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(accessToken);
    }, 350);
  };

  // ---- Initial search on mount ----
  // Valid effect: triggers a network request side-effect once.
  React.useEffect(() => {
    if (searchStatus === 'idle') {
      void search(accessToken);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Re-search when filters (other than query) change ----
  const prevTagsRef = React.useRef(selectedTags);
  const prevSortRef = React.useRef(sortBy);

  React.useEffect(() => {
    const tagsChanged = prevTagsRef.current !== selectedTags;
    const sortChanged = prevSortRef.current !== sortBy;
    prevTagsRef.current = selectedTags;
    prevSortRef.current = sortBy;

    if (tagsChanged || sortChanged) {
      void search(accessToken);
    }
  }, [selectedTags, sortBy, search, accessToken]);

  // ---- Infinite scroll via IntersectionObserver ----
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore(accessToken);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore, accessToken]);

  // ---- Handlers ----

  const handleTagToggle = (tag: string) => {
    toggleTag(tag);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as typeof sortBy);
  };

  const handleInstall = (plugin: RegistryPlugin) => {
    void installPlugin(accessToken, workspaceId, plugin);
  };

  const handleUninstall = (pluginId: string) => {
    void uninstallPlugin(accessToken, workspaceId, pluginId);
  };

  const handleOpenDetail = (plugin: RegistryPlugin) => {
    void openDetail(accessToken, plugin);
  };

  const isFirstLoad = searchStatus === 'loading' && plugins.length === 0;
  const isLoadingMore = searchStatus === 'loading' && plugins.length > 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search plugins by name, author, or description..."
            value={query}
            onChange={handleQueryChange}
            size="md"
            aria-label="Search plugins"
            startIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            }
          />
        </div>

        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-44" aria-label="Sort plugins by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active tag filters */}
      {selectedTags.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="region"
          aria-label="Active tag filters"
        >
          <span className="text-xs text-foreground-secondary">Filtering by:</span>
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" onRemove={() => toggleTag(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Results count */}
      {searchStatus !== 'idle' && !isFirstLoad && (
        <p className="text-xs text-foreground-secondary" aria-live="polite">
          {total > 0
            ? `Showing ${plugins.length} of ${total} plugin${total !== 1 ? 's' : ''}`
            : searchStatus !== 'loading'
              ? 'No plugins found'
              : ''}
        </p>
      )}

      {/* Search error */}
      {searchStatus === 'error' && searchError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <p className="text-sm text-destructive font-medium">Failed to load plugins</p>
          <p className="text-xs text-destructive/80 mt-1">{searchError}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => void search(accessToken)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main content: sidebar + grid */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Tag sidebar */}
        <TagFilterSidebar
          availableTags={availableTags}
          selectedTags={selectedTags}
          onToggle={handleTagToggle}
          onClear={clearTags}
        />

        {/* Plugin grid */}
        <div className="flex-1 overflow-y-auto">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            aria-label="Plugin results"
          >
            {isFirstLoad && <PluginGridSkeleton />}

            {!isFirstLoad &&
              plugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={installedPluginIds.has(plugin.id)}
                  operation={selectBrowserPluginOp(operations, plugin.id)}
                  onInstall={handleInstall}
                  onUninstall={handleUninstall}
                  onOpenDetail={handleOpenDetail}
                  onTagClick={handleTagToggle}
                />
              ))}
          </div>

          {/* Empty state */}
          {!isFirstLoad && searchStatus !== 'loading' && plugins.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12 text-foreground-muted"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6M11 8v6" />
              </svg>
              <p className="text-sm font-medium text-foreground">No plugins found</p>
              <p className="text-xs text-foreground-secondary max-w-xs">
                {query || selectedTags.length > 0
                  ? 'Try adjusting your search or tag filters.'
                  : 'The plugin registry appears to be empty. Plugins are sourced from GitHub repositories with the "notesaner-plugin" topic.'}
              </p>
              {(query || selectedTags.length > 0) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setQuery('');
                    clearTags();
                    void search(accessToken);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Load more trigger / skeleton */}
          {cursor && (
            <div ref={sentinelRef} className="py-4">
              {isLoadingMore && (
                <div
                  className="grid gap-4 mt-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                  aria-hidden="true"
                >
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex-1 flex flex-col gap-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <PluginDetailModal
        plugin={detailPlugin}
        open={detailPlugin !== null}
        detailStatus={detailStatus}
        detailError={detailError}
        isInstalled={detailPlugin ? installedPluginIds.has(detailPlugin.id) : false}
        operation={
          detailPlugin ? selectBrowserPluginOp(operations, detailPlugin.id) : { status: 'idle' }
        }
        onClose={closeDetail}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
      />
    </div>
  );
}
