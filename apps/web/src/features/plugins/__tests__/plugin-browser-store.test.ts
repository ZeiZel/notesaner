/**
 * Tests for plugin-browser-store.ts
 *
 * Covers:
 *   - setQuery / toggleTag / clearTags / setSortBy — filter mutations
 *   - search — success, error, tag collection
 *   - loadMore — appends results, respects cursor
 *   - openDetail — sets detail plugin and fetches full data
 *   - closeDetail — resets detail state
 *   - installPlugin — success path, error path, updates installedPluginIds
 *   - uninstallPlugin — success path, error path, updates installedPluginIds
 *   - setInstalledPluginIds — direct sync
 *   - selectBrowserPluginOp — returns idle for unknown plugins
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePluginBrowserStore, selectBrowserPluginOp } from '../model/plugin-browser-store';
import type { RegistryPlugin } from '../api/plugin-registry-api';

// ---------------------------------------------------------------------------
// Mock the API module
// ---------------------------------------------------------------------------

vi.mock('../api/plugin-registry-api', () => ({
  pluginRegistryApi: {
    search: vi.fn(),
    getDetail: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    toggle: vi.fn(),
  },
}));

const { pluginRegistryApi } = await import('../api/plugin-registry-api');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(id: string, overrides: Partial<RegistryPlugin> = {}): RegistryPlugin {
  return {
    id,
    name: `Plugin ${id}`,
    description: `Description for ${id}`,
    author: 'test-author',
    repository: `https://github.com/test-author/${id}`,
    tags: ['productivity', 'notes'],
    latestVersion: '1.0.0',
    stars: 100,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetStore() {
  usePluginBrowserStore.setState({
    query: '',
    selectedTags: [],
    sortBy: 'stars',
    plugins: [],
    total: 0,
    cursor: null,
    searchStatus: 'idle',
    searchError: null,
    availableTags: [],
    detailPlugin: null,
    detailStatus: 'idle',
    detailError: null,
    operations: {},
    installedPluginIds: new Set(),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Filter mutations
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — filter mutations', () => {
  it('setQuery updates the query field', () => {
    usePluginBrowserStore.getState().setQuery('calendar');
    expect(usePluginBrowserStore.getState().query).toBe('calendar');
  });

  it('toggleTag adds a tag when not selected', () => {
    usePluginBrowserStore.getState().toggleTag('editor');
    expect(usePluginBrowserStore.getState().selectedTags).toContain('editor');
  });

  it('toggleTag removes a tag when already selected', () => {
    usePluginBrowserStore.setState({ selectedTags: ['editor', 'notes'] });
    usePluginBrowserStore.getState().toggleTag('editor');
    expect(usePluginBrowserStore.getState().selectedTags).not.toContain('editor');
    expect(usePluginBrowserStore.getState().selectedTags).toContain('notes');
  });

  it('clearTags empties the selected tags array', () => {
    usePluginBrowserStore.setState({ selectedTags: ['editor', 'notes'] });
    usePluginBrowserStore.getState().clearTags();
    expect(usePluginBrowserStore.getState().selectedTags).toHaveLength(0);
  });

  it('setSortBy updates the sort field', () => {
    usePluginBrowserStore.getState().setSortBy('updated');
    expect(usePluginBrowserStore.getState().sortBy).toBe('updated');
  });
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — search', () => {
  it('populates plugins and sets status to success on a successful fetch', async () => {
    const plugins = [makePlugin('plugin-a'), makePlugin('plugin-b')];
    vi.mocked(pluginRegistryApi.search).mockResolvedValueOnce({
      plugins,
      total: 2,
      cursor: null,
    });

    await usePluginBrowserStore.getState().search('token-abc');

    const state = usePluginBrowserStore.getState();
    expect(state.searchStatus).toBe('success');
    expect(state.plugins).toHaveLength(2);
    expect(state.total).toBe(2);
    expect(state.cursor).toBeNull();
  });

  it('replaces existing plugins on a fresh search', async () => {
    usePluginBrowserStore.setState({ plugins: [makePlugin('old-plugin')] });

    vi.mocked(pluginRegistryApi.search).mockResolvedValueOnce({
      plugins: [makePlugin('new-plugin')],
      total: 1,
      cursor: null,
    });

    await usePluginBrowserStore.getState().search('token-abc');
    expect(usePluginBrowserStore.getState().plugins).toHaveLength(1);
    expect(usePluginBrowserStore.getState().plugins[0]!.id).toBe('new-plugin');
  });

  it('collects unique tags from results into availableTags', async () => {
    vi.mocked(pluginRegistryApi.search).mockResolvedValueOnce({
      plugins: [
        makePlugin('a', { tags: ['editor', 'productivity'] }),
        makePlugin('b', { tags: ['notes', 'editor'] }),
      ],
      total: 2,
      cursor: null,
    });

    await usePluginBrowserStore.getState().search('token-abc');

    const { availableTags } = usePluginBrowserStore.getState();
    expect(availableTags).toContain('editor');
    expect(availableTags).toContain('productivity');
    expect(availableTags).toContain('notes');
    // Should be de-duplicated
    expect(availableTags.filter((t) => t === 'editor')).toHaveLength(1);
  });

  it('sets status to error when the API throws', async () => {
    vi.mocked(pluginRegistryApi.search).mockRejectedValueOnce(new Error('Network error'));

    await usePluginBrowserStore.getState().search('token-abc');

    const state = usePluginBrowserStore.getState();
    expect(state.searchStatus).toBe('error');
    expect(state.searchError).toBe('Network error');
  });

  it('passes query and filters to the API', async () => {
    usePluginBrowserStore.setState({
      query: 'calendar',
      selectedTags: ['productivity'],
      sortBy: 'updated',
    });

    vi.mocked(pluginRegistryApi.search).mockResolvedValueOnce({
      plugins: [],
      total: 0,
      cursor: null,
    });

    await usePluginBrowserStore.getState().search('token-abc');

    expect(pluginRegistryApi.search).toHaveBeenCalledWith('token-abc', {
      q: 'calendar',
      tags: ['productivity'],
      sortBy: 'updated',
      limit: 20,
    });
  });
});

// ---------------------------------------------------------------------------
// loadMore
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — loadMore', () => {
  it('appends results to existing plugins', async () => {
    usePluginBrowserStore.setState({
      plugins: [makePlugin('plugin-a')],
      cursor: 'page-2',
      searchStatus: 'success',
    });

    vi.mocked(pluginRegistryApi.search).mockResolvedValueOnce({
      plugins: [makePlugin('plugin-b'), makePlugin('plugin-c')],
      total: 3,
      cursor: null,
    });

    await usePluginBrowserStore.getState().loadMore('token-abc');

    const state = usePluginBrowserStore.getState();
    expect(state.plugins).toHaveLength(3);
    expect(state.cursor).toBeNull();
  });

  it('is a no-op when cursor is null', async () => {
    usePluginBrowserStore.setState({ cursor: null });
    await usePluginBrowserStore.getState().loadMore('token-abc');
    expect(pluginRegistryApi.search).not.toHaveBeenCalled();
  });

  it('is a no-op while already loading', async () => {
    usePluginBrowserStore.setState({ cursor: 'page-2', searchStatus: 'loading' });
    await usePluginBrowserStore.getState().loadMore('token-abc');
    expect(pluginRegistryApi.search).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// openDetail / closeDetail
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — openDetail / closeDetail', () => {
  it('immediately sets detailPlugin with the provided plugin data', async () => {
    const plugin = makePlugin('my-plugin');
    vi.mocked(pluginRegistryApi.getDetail).mockResolvedValueOnce({
      ...plugin,
      readme: 'Full README here',
    });

    const openPromise = usePluginBrowserStore.getState().openDetail('token', plugin);

    // Check that detailPlugin is set before the API call resolves
    expect(usePluginBrowserStore.getState().detailPlugin?.id).toBe('my-plugin');
    expect(usePluginBrowserStore.getState().detailStatus).toBe('loading');

    await openPromise;

    expect(usePluginBrowserStore.getState().detailStatus).toBe('success');
    expect(usePluginBrowserStore.getState().detailPlugin?.readme).toBe('Full README here');
  });

  it('sets detailStatus to error (but keeps detailPlugin) when API fails', async () => {
    const plugin = makePlugin('broken-plugin');
    vi.mocked(pluginRegistryApi.getDetail).mockRejectedValueOnce(new Error('Not found'));

    await usePluginBrowserStore.getState().openDetail('token', plugin);

    const state = usePluginBrowserStore.getState();
    expect(state.detailStatus).toBe('error');
    expect(state.detailError).toBe('Not found');
    // Plugin is still set so the partial data remains visible
    expect(state.detailPlugin?.id).toBe('broken-plugin');
  });

  it('closeDetail resets the detail state', () => {
    usePluginBrowserStore.setState({
      detailPlugin: makePlugin('some-plugin'),
      detailStatus: 'success',
    });

    usePluginBrowserStore.getState().closeDetail();

    const state = usePluginBrowserStore.getState();
    expect(state.detailPlugin).toBeNull();
    expect(state.detailStatus).toBe('idle');
    expect(state.detailError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// installPlugin
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — installPlugin', () => {
  it('adds the plugin id to installedPluginIds on success', async () => {
    const plugin = makePlugin('to-install');
    vi.mocked(pluginRegistryApi.install).mockResolvedValueOnce({
      id: 'db-id',
      workspaceId: 'ws-1',
      pluginId: 'to-install',
      name: 'To Install',
      version: '1.0.0',
      repository: plugin.repository,
      isEnabled: true,
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await usePluginBrowserStore.getState().installPlugin('token', 'ws-1', plugin);

    const state = usePluginBrowserStore.getState();
    expect(state.installedPluginIds.has('to-install')).toBe(true);
    expect(state.operations['to-install']?.status).toBe('success');
  });

  it('sets operation status to error and rethrows on API failure', async () => {
    const plugin = makePlugin('bad-install');
    vi.mocked(pluginRegistryApi.install).mockRejectedValueOnce(new Error('Install failed'));

    await expect(
      usePluginBrowserStore.getState().installPlugin('token', 'ws-1', plugin),
    ).rejects.toThrow('Install failed');

    const state = usePluginBrowserStore.getState();
    expect(state.operations['bad-install']?.status).toBe('error');
    expect(state.operations['bad-install']?.error).toBe('Install failed');
    expect(state.installedPluginIds.has('bad-install')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uninstallPlugin
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — uninstallPlugin', () => {
  it('removes the plugin id from installedPluginIds on success', async () => {
    usePluginBrowserStore.setState({
      installedPluginIds: new Set(['to-remove', 'other-plugin']),
    });
    vi.mocked(pluginRegistryApi.uninstall).mockResolvedValueOnce(undefined);

    await usePluginBrowserStore.getState().uninstallPlugin('token', 'ws-1', 'to-remove');

    const state = usePluginBrowserStore.getState();
    expect(state.installedPluginIds.has('to-remove')).toBe(false);
    expect(state.installedPluginIds.has('other-plugin')).toBe(true);
    expect(state.operations['to-remove']?.status).toBe('success');
  });

  it('sets operation status to error and rethrows on API failure', async () => {
    vi.mocked(pluginRegistryApi.uninstall).mockRejectedValueOnce(new Error('Not found'));

    await expect(
      usePluginBrowserStore.getState().uninstallPlugin('token', 'ws-1', 'ghost-plugin'),
    ).rejects.toThrow('Not found');

    const state = usePluginBrowserStore.getState();
    expect(state.operations['ghost-plugin']?.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// setInstalledPluginIds
// ---------------------------------------------------------------------------

describe('usePluginBrowserStore — setInstalledPluginIds', () => {
  it('replaces the installedPluginIds set', () => {
    usePluginBrowserStore.setState({
      installedPluginIds: new Set(['old-plugin']),
    });

    usePluginBrowserStore.getState().setInstalledPluginIds(new Set(['plugin-a', 'plugin-b']));

    const ids = usePluginBrowserStore.getState().installedPluginIds;
    expect(ids.has('old-plugin')).toBe(false);
    expect(ids.has('plugin-a')).toBe(true);
    expect(ids.has('plugin-b')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectBrowserPluginOp
// ---------------------------------------------------------------------------

describe('selectBrowserPluginOp', () => {
  it('returns idle for an unknown plugin id', () => {
    const op = selectBrowserPluginOp({}, 'unknown');
    expect(op.status).toBe('idle');
  });

  it('returns the stored operation state', () => {
    const ops = {
      'my-plugin': { status: 'loading' as const },
    };
    expect(selectBrowserPluginOp(ops, 'my-plugin').status).toBe('loading');
  });
});
