'use client';

/**
 * PluginBrowser
 *
 * Main plugin discovery UI — the "Plugin Browser" page in Settings.
 * Migrated from shadcn/ui to Ant Design components.
 */

import * as React from 'react';
import { Input, Select, Button, Tag, Skeleton, Alert, Flex, Typography, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { PluginCard } from './PluginCard';
import { PluginDetailModal } from './PluginDetailModal';
import { usePluginBrowserStore, selectBrowserPluginOp } from '../model/plugin-browser-store';
import type { RegistryPlugin } from '../api/plugin-registry-api';

const { Text } = Typography;

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
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            borderRadius: 12,
            border: '1px solid var(--ant-color-border)',
            padding: 16,
          }}
          aria-hidden="true"
        >
          <Flex gap={12} align="start">
            <Skeleton.Avatar active size={40} shape="square" />
            <Flex vertical gap={6} flex={1}>
              <Skeleton.Input active size="small" style={{ width: 128 }} />
              <Skeleton.Input active size="small" style={{ width: 80 }} />
            </Flex>
          </Flex>
          <Skeleton.Input active size="small" block />
          <Skeleton.Input active size="small" style={{ width: '75%' }} />
          <Flex gap={6}>
            <Skeleton.Button active size="small" shape="round" style={{ width: 56 }} />
            <Skeleton.Button active size="small" shape="round" style={{ width: 64 }} />
          </Flex>
          <Flex justify="space-between">
            <Skeleton.Input active size="small" style={{ width: 40 }} />
            <Skeleton.Button active size="small" style={{ width: 80 }} />
          </Flex>
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
    <aside style={{ width: 192, flexShrink: 0 }} aria-label="Filter plugins by tag">
      <Flex vertical gap={8}>
        <Flex justify="space-between" align="center">
          <Text
            type="secondary"
            strong
            style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Tags
          </Text>
          {selectedTags.length > 0 && (
            <Button type="link" size="small" onClick={onClear} aria-label="Clear all tag filters">
              Clear
            </Button>
          )}
        </Flex>

        {availableTags.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No tags available.
          </Text>
        ) : (
          <Flex vertical gap={2}>
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <Tag
                  key={tag}
                  color={active ? 'processing' : undefined}
                  onClick={() => onToggle(tag)}
                  style={{ cursor: 'pointer', margin: 0 }}
                >
                  {tag}
                </Tag>
              );
            })}
          </Flex>
        )}
      </Flex>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sort control
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'stars', label: 'Most popular' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name (A-Z)' },
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
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(accessToken);
    }, 350);
  };

  // Effect: initial search on mount and debounce timer cleanup.
  // TODO: migrate to TanStack Query with useInfiniteQuery for plugin search.
  React.useEffect(() => {
    if (searchStatus === 'idle') {
      void search(accessToken);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Effect: re-search when filter state changes in the store.
  // TODO: migrate to TanStack Query -- filters become queryKey params.
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

  // Effect: IntersectionObserver for infinite scroll (valid browser API subscription)
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
    <Flex vertical gap={16} style={{ height: '100%' }}>
      {/* Toolbar */}
      <Flex gap={12} align="center">
        <div style={{ flex: 1 }}>
          <Input
            type="search"
            placeholder="Search plugins by name, author, or description..."
            value={query}
            onChange={handleQueryChange}
            prefix={<SearchOutlined />}
            aria-label="Search plugins"
            allowClear
          />
        </div>

        <Select
          value={sortBy}
          onChange={handleSortChange}
          style={{ width: 176 }}
          aria-label="Sort plugins by"
          options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        />
      </Flex>

      {/* Active tag filters */}
      {selectedTags.length > 0 && (
        <Space wrap size={[8, 8]} aria-label="Active tag filters">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Filtering by:
          </Text>
          {selectedTags.map((tag) => (
            <Tag key={tag} closable onClose={() => toggleTag(tag)} color="blue">
              {tag}
            </Tag>
          ))}
        </Space>
      )}

      {/* Results count */}
      {searchStatus !== 'idle' && !isFirstLoad && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {total > 0
            ? `Showing ${plugins.length} of ${total} plugin${total !== 1 ? 's' : ''}`
            : searchStatus !== 'loading'
              ? 'No plugins found'
              : ''}
        </Text>
      )}

      {/* Search error */}
      {searchStatus === 'error' && searchError && (
        <Alert
          type="error"
          message="Failed to load plugins"
          description={searchError}
          showIcon
          action={
            <Button size="small" onClick={() => void search(accessToken)}>
              Retry
            </Button>
          }
        />
      )}

      {/* Main content: sidebar + grid */}
      <Flex gap={24} flex={1} style={{ overflow: 'hidden' }}>
        {/* Tag sidebar */}
        <TagFilterSidebar
          availableTags={availableTags}
          selectedTags={selectedTags}
          onToggle={handleTagToggle}
          onClear={clearTags}
        />

        {/* Plugin grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
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
            <Flex vertical align="center" justify="center" gap={12} style={{ paddingBlock: 64 }}>
              <SearchOutlined style={{ fontSize: 48, color: 'var(--ant-color-text-quaternary)' }} />
              <Text strong>No plugins found</Text>
              <Text type="secondary" style={{ fontSize: 12, maxWidth: 280, textAlign: 'center' }}>
                {query || selectedTags.length > 0
                  ? 'Try adjusting your search or tag filters.'
                  : 'The plugin registry appears to be empty. Plugins are sourced from GitHub repositories with the "notesaner-plugin" topic.'}
              </Text>
              {(query || selectedTags.length > 0) && (
                <Button
                  type="text"
                  size="small"
                  onClick={() => {
                    setQuery('');
                    clearTags();
                    void search(accessToken);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </Flex>
          )}

          {/* Load more trigger / skeleton */}
          {cursor && (
            <div ref={sentinelRef} style={{ padding: '16px 0' }}>
              {isLoadingMore && (
                <Flex vertical gap={16} style={{ marginTop: 16 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} active paragraph={{ rows: 3 }} />
                  ))}
                </Flex>
              )}
            </div>
          )}
        </div>
      </Flex>

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
    </Flex>
  );
}
