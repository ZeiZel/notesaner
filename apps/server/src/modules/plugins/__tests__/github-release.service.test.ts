import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitHubReleaseService } from '../github-release.service';
import type { ValkeyService } from '../../valkey/valkey.service';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
const mockRm = vi.fn().mockResolvedValue(undefined);
const mockStat = vi.fn();
const mockReaddir = vi.fn();
const mockRename = vi.fn().mockResolvedValue(undefined);
const mockCp = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  rm: (...args: unknown[]) => mockRm(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  cp: (...args: unknown[]) => mockCp(...args),
}));

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({
    on: vi.fn(function (
      this: { on: ReturnType<typeof vi.fn> },
      event: string,
      cb: (...args: unknown[]) => void,
    ) {
      if (event === 'data') cb(Buffer.from('fake-data'));
      if (event === 'end') cb();
      return this;
    }),
  })),
  createWriteStream: vi.fn(() => ({ on: vi.fn(), pipe: vi.fn() })),
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:stream', () => ({
  Readable: {
    fromWeb: vi.fn(() => ({ pipe: vi.fn() })),
  },
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn(
    (
      _cmd: string,
      _opts: unknown,
      cb: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      cb(null, { stdout: '', stderr: '' });
    },
  ),
}));

vi.mock('node:util', () => ({
  promisify: vi.fn(() => {
    return vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_ROOT = '/var/lib/notesaner/workspaces';
const WORKSPACE_ID = 'ws-test-123';

function makeConfigService(overrides?: Record<string, unknown>): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'github.token': 'ghp_test_default_token',
        'storage.root': STORAGE_ROOT,
        ...overrides,
      };
      return config[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

function makeValkeyService(cache?: Map<string, string>): ValkeyService {
  const store = cache ?? new Map<string, string>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string, _ttl?: number) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),
    ping: vi.fn().mockResolvedValue(true),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key))),
    expire: vi.fn().mockResolvedValue(true),
    getClient: vi.fn(),
    onModuleDestroy: vi.fn(),
  } as unknown as ValkeyService;
}

function makeGitHubReleaseResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    tag_name: 'v1.0.0',
    name: 'Release v1.0.0',
    body: 'Initial release',
    prerelease: false,
    published_at: '2026-01-15T10:00:00Z',
    assets: [
      {
        name: 'plugin.zip',
        browser_download_url: 'https://github.com/test/plugin/releases/download/v1.0.0/plugin.zip',
        size: 1024,
        content_type: 'application/zip',
      },
    ],
    ...overrides,
  };
}

function makeValidManifest(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    id: 'io.notesaner.test-plugin',
    name: 'Test Plugin',
    description: 'A test plugin',
    version: '1.0.0',
    minSdkVersion: '0.1.0',
    repository: 'test/plugin',
    author: 'Test Author',
    main: 'dist/index.js',
    ...overrides,
  });
}

function makeService(configOverrides?: Record<string, unknown>, cache?: Map<string, string>) {
  const configService = makeConfigService(configOverrides);
  const valkeyService = makeValkeyService(cache);
  const service = new GitHubReleaseService(configService, valkeyService);
  return { service, configService, valkeyService };
}

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockMkdir.mockReset().mockResolvedValue(undefined);
  mockReadFile.mockReset();
  mockRm.mockReset().mockResolvedValue(undefined);
  mockStat.mockReset();
  mockReaddir.mockReset();
  mockRename.mockReset().mockResolvedValue(undefined);
  mockCp.mockReset().mockResolvedValue(undefined);

  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GitHubReleaseService', () => {
  // -- fetchLatestRelease ---------------------------------------------------

  describe('fetchLatestRelease', () => {
    it('should fetch and parse the latest release from GitHub', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(releaseData), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await service.fetchLatestRelease('test/plugin');

      expect(result.tagName).toBe('v1.0.0');
      expect(result.version).toBe('1.0.0');
      expect(result.zipAsset).not.toBeNull();
      expect(result.zipAsset?.name).toBe('plugin.zip');
    });

    it('should return cached result on second call', async () => {
      const cache = new Map<string, string>();
      const { service } = makeService(undefined, cache);
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      // First call -- fetches from GitHub
      const first = await service.fetchLatestRelease('test/plugin');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call -- should use cache
      const second = await service.fetchLatestRelease('test/plugin');
      expect(fetchMock).toHaveBeenCalledTimes(1); // no additional fetch
      expect(second.version).toBe(first.version);
    });

    it('should throw NotFoundException for 404 responses', async () => {
      const { service } = makeService();

      fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      await expect(service.fetchLatestRelease('test/nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid repository format', async () => {
      const { service } = makeService();

      await expect(service.fetchLatestRelease('invalid-format')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use the provided token for private repos', async () => {
      const { service } = makeService({ 'github.token': undefined });
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchLatestRelease('private/repo', 'ghp_user_token');

      const callHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBe('Bearer ghp_user_token');
    });

    it('should throw ServiceUnavailableException on exhausted rate limit', async () => {
      const { service } = makeService();

      fetchMock.mockResolvedValue(
        new Response('Forbidden', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
      );

      await expect(service.fetchLatestRelease('test/plugin')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // -- fetchReleaseByTag ----------------------------------------------------

  describe('fetchReleaseByTag', () => {
    it('should fetch a release by tag with v prefix', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const result = await service.fetchReleaseByTag('test/plugin', '1.0.0');
      expect(result.version).toBe('1.0.0');

      // Should have tried v1.0.0 first
      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('v1.0.0');
    });

    it('should fall back to tag without v prefix if v-prefixed tag returns 404', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse({ tag_name: '1.0.0' });

      // First try with "v1.0.0" -> 404
      fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
      // Second try with "1.0.0" -> success
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const result = await service.fetchReleaseByTag('test/plugin', '1.0.0');
      expect(result.tagName).toBe('1.0.0');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when neither tag format is found', async () => {
      const { service } = makeService();

      fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));

      await expect(service.fetchReleaseByTag('test/plugin', '99.99.99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -- Retry with exponential backoff ---------------------------------------

  describe('retry with exponential backoff', () => {
    it('should retry on 429 and succeed on subsequent attempt', async () => {
      vi.useFakeTimers();
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // First call -> 429 with retry-after: 0
      fetchMock.mockResolvedValueOnce(
        new Response('Too Many Requests', {
          status: 429,
          headers: { 'retry-after': '0' },
        }),
      );
      // Second call -> success
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const promise = service.fetchLatestRelease('test/plugin');

      // Advance timers to allow the sleep to resolve
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.version).toBe('1.0.0');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed on subsequent attempt', async () => {
      vi.useFakeTimers();
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // First call -> 503
      fetchMock.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));
      // Second call -> success
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const promise = service.fetchLatestRelease('test/plugin');
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.version).toBe('1.0.0');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on persistent 503', async () => {
      const { service } = makeService();

      fetchMock.mockResolvedValue(new Response('Service Unavailable', { status: 503 }));

      await expect(service.fetchLatestRelease('test/plugin')).rejects.toThrow(
        ServiceUnavailableException,
      );

      // 1 initial + 3 retries = 4 total calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
    }, // Allow extra time for the real backoff delays (1s + 2s + 4s)
    15_000);

    it('should retry on network errors', async () => {
      vi.useFakeTimers();
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // First call -> network error
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      // Second call -> success
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const promise = service.fetchLatestRelease('test/plugin');
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.version).toBe('1.0.0');
    });
  });

  // -- ValKey caching -------------------------------------------------------

  describe('ValKey caching', () => {
    it('should cache release data with the correct key format', async () => {
      const cache = new Map<string, string>();
      const { service, valkeyService } = makeService(undefined, cache);
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchLatestRelease('test/plugin');

      expect(valkeyService.set).toHaveBeenCalledWith(
        'gh:release:test:plugin:latest',
        expect.any(String),
        3600,
      );
    });

    it('should cache tagged release with version-specific key', async () => {
      const cache = new Map<string, string>();
      const { service, valkeyService } = makeService(undefined, cache);
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchReleaseByTag('test/plugin', '1.0.0');

      expect(valkeyService.set).toHaveBeenCalledWith(
        'gh:release:test:plugin:1.0.0',
        expect.any(String),
        3600,
      );
    });

    it('should invalidate cache when requested', async () => {
      const cache = new Map<string, string>();
      cache.set('gh:release:test:plugin:latest', JSON.stringify({}));
      const { service, valkeyService } = makeService(undefined, cache);

      await service.invalidateCache('test/plugin');

      expect(valkeyService.del).toHaveBeenCalledWith('gh:release:test:plugin:latest');
    });

    it('should handle cache read failures gracefully', async () => {
      const { service, valkeyService } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // Make cache throw on read
      vi.mocked(valkeyService.get).mockRejectedValueOnce(new Error('Redis down'));

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      // Should still succeed by falling back to GitHub API
      const result = await service.fetchLatestRelease('test/plugin');
      expect(result.version).toBe('1.0.0');
    });

    it('should handle cache write failures gracefully', async () => {
      const { service, valkeyService } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // Make cache throw on write
      vi.mocked(valkeyService.set).mockRejectedValueOnce(new Error('Redis down'));

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      // Should still succeed -- cache failure is non-fatal
      const result = await service.fetchLatestRelease('test/plugin');
      expect(result.version).toBe('1.0.0');
    });
  });

  // -- Private repo support -------------------------------------------------

  describe('private repository support', () => {
    it('should use server-wide token by default', async () => {
      const { service } = makeService({ 'github.token': 'ghp_server_token' });
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchLatestRelease('test/plugin');

      const callHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBe('Bearer ghp_server_token');
    });

    it('should prefer user-provided token over server token', async () => {
      const { service } = makeService({ 'github.token': 'ghp_server_token' });
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchLatestRelease('private/repo', 'ghp_user_token');

      const callHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBe('Bearer ghp_user_token');
    });

    it('should not set Authorization header when no token is available', async () => {
      const { service } = makeService({ 'github.token': undefined });
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await service.fetchLatestRelease('test/plugin');

      const callHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBeUndefined();
    });
  });

  // -- installFromGitHub ----------------------------------------------------

  describe('installFromGitHub', () => {
    it('should install a plugin to the workspace plugin directory', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      // Mock GitHub API call
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      // Mock asset download
      fetchMock.mockResolvedValueOnce(
        new Response(Buffer.from('fake-zip'), {
          status: 200,
          headers: { 'content-type': 'application/zip' },
        }),
      );

      // Mock readdir for resolveExtractedRoot: plugin.json present
      mockReaddir.mockResolvedValueOnce([
        { name: 'plugin.json', isFile: () => true, isDirectory: () => false },
        { name: 'dist', isFile: () => false, isDirectory: () => true },
      ]);

      // Mock readFile for manifest parsing
      mockReadFile.mockResolvedValueOnce(makeValidManifest());

      const result = await service.installFromGitHub('test/plugin', WORKSPACE_ID);

      expect(result.manifest.id).toBe('io.notesaner.test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.installPath).toContain(WORKSPACE_ID);
      expect(result.installPath).toContain('plugins');
      expect(result.installPath).toContain('io.notesaner.test-plugin');
    });

    it('should throw NotFoundException when no zip asset exists', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse({ assets: [] });

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await expect(service.installFromGitHub('test/plugin', WORKSPACE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when zip exceeds size limit', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse({
        assets: [
          {
            name: 'plugin.zip',
            browser_download_url: 'https://example.com/plugin.zip',
            size: 100 * 1024 * 1024, // 100 MB
            content_type: 'application/zip',
          },
        ],
      });

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      await expect(service.installFromGitHub('test/plugin', WORKSPACE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should verify checksum when expectedChecksum is provided', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(Buffer.from('fake-zip'), { status: 200 }));

      // The checksum computed from "fake-data" (from our mock createReadStream)
      // does not match the provided checksum -- should throw
      await expect(
        service.installFromGitHub('test/plugin', WORKSPACE_ID, {
          expectedChecksum: 'a'.repeat(64),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use user-provided GitHub token for private repos', async () => {
      const { service } = makeService({ 'github.token': undefined });
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(Buffer.from('fake-zip'), { status: 200 }));

      mockReaddir.mockResolvedValueOnce([
        { name: 'plugin.json', isFile: () => true, isDirectory: () => false },
      ]);
      mockReadFile.mockResolvedValueOnce(makeValidManifest());

      await service.installFromGitHub('private/repo', WORKSPACE_ID, {
        githubToken: 'ghp_user_private_token',
      });

      // Both API and download calls should use the user token
      for (const call of fetchMock.mock.calls) {
        const headers = call[1]?.headers as Record<string, string> | undefined;
        if (headers?.['Authorization']) {
          expect(headers['Authorization']).toBe('Bearer ghp_user_private_token');
        }
      }
    });

    it('should rollback extraction on manifest parse failure', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse();

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(Buffer.from('fake-zip'), { status: 200 }));

      // readdir -> plugin.json present
      mockReaddir.mockResolvedValueOnce([
        { name: 'plugin.json', isFile: () => true, isDirectory: () => false },
      ]);

      // readFile -> invalid JSON (will cause manifest parse failure)
      mockReadFile.mockResolvedValueOnce('not valid json');

      await expect(service.installFromGitHub('test/plugin', WORKSPACE_ID)).rejects.toThrow(
        BadRequestException,
      );

      // Verify staging directory was cleaned up (rollback)
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('.staging'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });
  });

  // -- checkForUpdate -------------------------------------------------------

  describe('checkForUpdate', () => {
    it('should detect when an update is available', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse({ tag_name: 'v2.0.0' });

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const result = await service.checkForUpdate('test-plugin', 'test/plugin', '1.0.0');

      expect(result.updateAvailable).toBe(true);
      expect(result.latestVersion).toBe('2.0.0');
      expect(result.currentVersion).toBe('1.0.0');
    });

    it('should report no update when version is current', async () => {
      const { service } = makeService();
      const releaseData = makeGitHubReleaseResponse({ tag_name: 'v1.0.0' });

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(releaseData), { status: 200 }));

      const result = await service.checkForUpdate('test-plugin', 'test/plugin', '1.0.0');

      expect(result.updateAvailable).toBe(false);
    });

    it('should handle errors gracefully and report no update', async () => {
      const { service } = makeService();

      fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

      const result = await service.checkForUpdate('test-plugin', 'test/plugin', '1.0.0');

      expect(result.updateAvailable).toBe(false);
      expect(result.latestVersion).toBe('1.0.0');
    });
  });

  // -- parseManifest --------------------------------------------------------

  describe('parseManifest', () => {
    it('should parse a valid plugin manifest', async () => {
      const { service } = makeService();
      mockReadFile.mockResolvedValueOnce(makeValidManifest());

      const manifest = await service.parseManifest('/some/plugin/dir');

      expect(manifest.id).toBe('io.notesaner.test-plugin');
      expect(manifest.name).toBe('Test Plugin');
      expect(manifest.version).toBe('1.0.0');
    });

    it('should throw when plugin.json is missing', async () => {
      const { service } = makeService();
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      await expect(service.parseManifest('/some/dir')).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid JSON in manifest', async () => {
      const { service } = makeService();
      mockReadFile.mockResolvedValueOnce('not json {{{');

      await expect(service.parseManifest('/some/dir')).rejects.toThrow(BadRequestException);
    });

    it('should throw when required fields are missing', async () => {
      const { service } = makeService();
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ id: 'test', name: 'Test' }), // missing version, etc.
      );

      await expect(service.parseManifest('/some/dir')).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid plugin id characters', async () => {
      const { service } = makeService();
      mockReadFile.mockResolvedValueOnce(makeValidManifest({ id: 'invalid id with spaces' }));

      await expect(service.parseManifest('/some/dir')).rejects.toThrow(BadRequestException);
    });

    it('should include optional checksum field from manifest', async () => {
      const { service } = makeService();
      mockReadFile.mockResolvedValueOnce(makeValidManifest({ checksum: 'a'.repeat(64) }));

      const manifest = await service.parseManifest('/some/dir');
      expect(manifest.checksum).toBe('a'.repeat(64));
    });
  });

  // -- Workspace plugin directory -------------------------------------------

  describe('getWorkspacePluginDir', () => {
    it('should return the correct workspace plugin path', () => {
      const { service } = makeService();

      const dir = service.getWorkspacePluginDir('ws-123', 'io.notesaner.focus-mode');

      expect(dir).toBe(`${STORAGE_ROOT}/ws-123/plugins/io.notesaner.focus-mode`);
    });
  });

  // -- isCached -------------------------------------------------------------

  describe('isCached', () => {
    it('should return true when cached directory exists', async () => {
      const { service } = makeService();
      mockStat.mockResolvedValueOnce({ isDirectory: () => true });

      const result = await service.isCached('test/plugin', '1.0.0');
      expect(result).toBe(true);
    });

    it('should return false when cached directory does not exist', async () => {
      const { service } = makeService();
      mockStat.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.isCached('test/plugin', '1.0.0');
      expect(result).toBe(false);
    });
  });

  // -- listCachedVersions ---------------------------------------------------

  describe('listCachedVersions', () => {
    it('should return sorted list of cached versions', async () => {
      const { service } = makeService();
      mockReaddir.mockResolvedValueOnce(['1.2.0', '1.0.0', '1.1.0']);

      const versions = await service.listCachedVersions('test/plugin');
      expect(versions).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    });

    it('should return empty array when cache directory does not exist', async () => {
      const { service } = makeService();
      mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

      const versions = await service.listCachedVersions('test/plugin');
      expect(versions).toEqual([]);
    });
  });
});
