/**
 * Tests for plugin-registry-api.ts
 *
 * Covers:
 *   - search — builds correct query string for all params
 *   - getDetail — encodes repository correctly
 *   - listInstalled — calls correct workspace endpoint
 *   - install — sends correct payload
 *   - uninstall — calls correct endpoint
 *   - toggle — sends correct payload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pluginRegistryApi } from '../api/plugin-registry-api';
import type { RegistrySearchResult, InstalledPluginResponse } from '../api/plugin-registry-api';

// ---------------------------------------------------------------------------
// Mock the shared API client
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const { apiClient } = await import('@/shared/api/client');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSearchResult(overrides: Partial<RegistrySearchResult> = {}): RegistrySearchResult {
  return {
    plugins: [],
    total: 0,
    cursor: null,
    ...overrides,
  };
}

function makeInstalledResponse(pluginId: string): InstalledPluginResponse {
  return {
    id: 'db-id',
    workspaceId: 'ws-1',
    pluginId,
    name: `Plugin ${pluginId}`,
    version: '1.0.0',
    repository: `https://github.com/author/${pluginId}`,
    isEnabled: true,
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.search', () => {
  it('calls the correct endpoint with no params', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(makeSearchResult());
    await pluginRegistryApi.search('token');
    expect(apiClient.get).toHaveBeenCalledWith('/api/plugins/registry', { token: 'token' });
  });

  it('appends query string parameters when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(makeSearchResult());
    await pluginRegistryApi.search('token', {
      q: 'calendar',
      sortBy: 'updated',
      limit: 10,
    });
    const url = vi.mocked(apiClient.get).mock.calls[0]![0] as string;
    expect(url).toContain('q=calendar');
    expect(url).toContain('sort=updated');
    expect(url).toContain('limit=10');
  });

  it('appends tags joined by comma', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(makeSearchResult());
    await pluginRegistryApi.search('token', { tags: ['notes', 'editor'] });
    const url = vi.mocked(apiClient.get).mock.calls[0]![0] as string;
    expect(url).toContain('tags=notes%2Ceditor');
  });

  it('does not append empty tags array', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(makeSearchResult());
    await pluginRegistryApi.search('token', { tags: [] });
    const url = vi.mocked(apiClient.get).mock.calls[0]![0] as string;
    expect(url).not.toContain('tags=');
  });

  it('includes the cursor for pagination', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(makeSearchResult());
    await pluginRegistryApi.search('token', { cursor: 'page-3' });
    const url = vi.mocked(apiClient.get).mock.calls[0]![0] as string;
    expect(url).toContain('cursor=page-3');
  });
});

// ---------------------------------------------------------------------------
// getDetail
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.getDetail', () => {
  it('encodes the repository in the URL', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({});
    await pluginRegistryApi.getDetail('token', 'author/my-plugin');
    const url = vi.mocked(apiClient.get).mock.calls[0]![0] as string;
    expect(url).toContain(encodeURIComponent('author/my-plugin'));
  });

  it('forwards the token', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({});
    await pluginRegistryApi.getDetail('my-token', 'author/repo');
    expect(apiClient.get).toHaveBeenCalledWith(expect.any(String), { token: 'my-token' });
  });
});

// ---------------------------------------------------------------------------
// listInstalled
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.listInstalled', () => {
  it('calls the workspace plugins endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([]);
    await pluginRegistryApi.listInstalled('token', 'ws-42');
    expect(apiClient.get).toHaveBeenCalledWith('/api/workspaces/ws-42/plugins', { token: 'token' });
  });
});

// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.install', () => {
  it('posts the repository and optional version', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(makeInstalledResponse('my-plugin'));
    await pluginRegistryApi.install('token', 'ws-1', {
      repository: 'https://github.com/author/my-plugin',
      version: '1.2.0',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/workspaces/ws-1/plugins/install',
      { repository: 'https://github.com/author/my-plugin', version: '1.2.0' },
      { token: 'token' },
    );
  });
});

// ---------------------------------------------------------------------------
// uninstall
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.uninstall', () => {
  it('calls the correct delete endpoint with encoded plugin id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);
    await pluginRegistryApi.uninstall('token', 'ws-1', 'com.author.my-plugin');
    expect(apiClient.delete).toHaveBeenCalledWith(
      `/api/workspaces/ws-1/plugins/${encodeURIComponent('com.author.my-plugin')}`,
      { token: 'token' },
    );
  });
});

// ---------------------------------------------------------------------------
// toggle
// ---------------------------------------------------------------------------

describe('pluginRegistryApi.toggle', () => {
  it('patches with enabled=true', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce(makeInstalledResponse('my-plugin'));
    await pluginRegistryApi.toggle('token', 'ws-1', 'my-plugin', true);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/workspaces/ws-1/plugins/my-plugin/toggle',
      { enabled: true },
      { token: 'token' },
    );
  });

  it('patches with enabled=false', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce(makeInstalledResponse('my-plugin'));
    await pluginRegistryApi.toggle('token', 'ws-1', 'my-plugin', false);
    expect(apiClient.patch).toHaveBeenCalledWith(
      expect.any(String),
      { enabled: false },
      expect.any(Object),
    );
  });
});
