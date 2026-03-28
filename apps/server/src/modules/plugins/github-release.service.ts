import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, readdir, rename, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ValkeyService } from '../valkey/valkey.service';
import type {
  GitHubRelease,
  GitHubReleaseAsset,
  PluginManifest,
  PluginInstallResult,
  PluginUpdateInfo,
} from './plugin.types';

// -- Constants ----------------------------------------------------------------

const GITHUB_API_BASE = 'https://api.github.com';
const PLUGIN_MANIFEST_FILENAME = 'plugin.json';
const PLUGIN_CACHE_DIR_NAME = '.plugin-cache';
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB safety limit
const GITHUB_API_TIMEOUT_MS = 30_000;

/** ValKey cache TTL for GitHub release metadata: 1 hour */
const RELEASE_CACHE_TTL_SECONDS = 3600;

/** Maximum number of retry attempts for transient GitHub errors */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (doubles on each retry) */
const BACKOFF_BASE_MS = 1000;

// -- Helpers ------------------------------------------------------------------

/**
 * Extract semver from a GitHub tag name.
 * Handles tags like "v1.2.3", "1.2.3", "v1.0.0-beta.1".
 */
function extractVersion(tagName: string): string {
  return tagName.replace(/^v/, '');
}

/**
 * Build the ValKey cache key for a GitHub release lookup.
 */
function buildReleaseCacheKey(owner: string, repo: string, tag?: string): string {
  const suffix = tag ? `:${tag}` : ':latest';
  return `gh:release:${owner}:${repo}${suffix}`;
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Service ------------------------------------------------------------------

@Injectable()
export class GitHubReleaseService {
  private readonly logger = new Logger(GitHubReleaseService.name);
  private readonly defaultGithubToken: string | undefined;
  private readonly storageRoot: string;
  private readonly cacheRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly valkey: ValkeyService,
  ) {
    this.defaultGithubToken = this.config.get<string>('github.token');
    this.storageRoot = this.config.get<string>('storage.root', '/var/lib/notesaner/workspaces');
    this.cacheRoot = resolve(this.storageRoot, '..', PLUGIN_CACHE_DIR_NAME);
  }

  // -- Public API -------------------------------------------------------------

  /**
   * Install a plugin from a GitHub release into a workspace.
   *
   * 1. Fetch the specified release (or latest) from GitHub.
   * 2. Download the .zip asset.
   * 3. Verify checksum (if provided in manifest or explicitly).
   * 4. Extract to a staging directory first.
   * 5. Parse and validate the plugin manifest.
   * 6. Atomically move to the workspace plugin directory.
   * 7. Rollback on any failure after partial extraction.
   */
  async installFromGitHub(
    repository: string,
    workspaceId: string,
    options?: {
      version?: string;
      expectedChecksum?: string;
      githubToken?: string;
    },
  ): Promise<PluginInstallResult> {
    const { version, expectedChecksum, githubToken } = options ?? {};
    const token = githubToken ?? this.defaultGithubToken;

    this.logger.log(
      `Installing plugin from ${repository}${version ? `@${version}` : ' (latest)'} ` +
        `into workspace ${workspaceId}`,
    );

    // 1. Fetch release metadata (with ValKey caching)
    const release = version
      ? await this.fetchReleaseByTag(repository, version, token)
      : await this.fetchLatestRelease(repository, token);

    if (!release.zipAsset) {
      throw new NotFoundException(
        `No .zip asset found in release ${release.tagName} for ${repository}. ` +
          'Plugin releases must include a .zip file.',
      );
    }

    // 2. Guard: size limit
    if (release.zipAsset.size > MAX_ZIP_SIZE_BYTES) {
      throw new BadRequestException(
        `Plugin archive size (${(release.zipAsset.size / 1024 / 1024).toFixed(1)} MB) exceeds ` +
          `the maximum allowed size (${MAX_ZIP_SIZE_BYTES / 1024 / 1024} MB).`,
      );
    }

    // 3. Download .zip to cache
    const zipPath = await this.downloadAsset(repository, release.version, release.zipAsset, token);

    // 4. Compute and verify checksum
    const checksum = await this.computeSha256(zipPath);
    let checksumVerified = false;

    if (expectedChecksum) {
      if (checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        await rm(zipPath, { force: true });
        throw new BadRequestException(
          `Checksum mismatch. Expected: ${expectedChecksum}, got: ${checksum}. ` +
            'The downloaded file has been discarded for security.',
        );
      }
      checksumVerified = true;
      this.logger.log(`Checksum verified for ${repository}@${release.version}`);
    }

    // 5. Extract to a staging directory (for rollback safety)
    const stagingDir = await this.extractToStaging(repository, release.version, zipPath);

    // 6. Parse manifest from staging
    let manifest: PluginManifest;
    try {
      manifest = await this.parseManifest(stagingDir);
    } catch (error) {
      // Rollback: remove the staging directory
      await rm(stagingDir, { recursive: true, force: true });
      throw error;
    }

    // 7. Verify manifest checksum if present and no explicit checksum was provided
    if (!expectedChecksum && manifest.checksum) {
      // Re-download was already done; compare against manifest checksum
      if (checksum.toLowerCase() !== manifest.checksum.toLowerCase()) {
        await rm(stagingDir, { recursive: true, force: true });
        throw new BadRequestException(
          `Checksum from manifest does not match downloaded file. ` +
            `Expected: ${manifest.checksum}, got: ${checksum}. ` +
            'The extraction has been rolled back for security.',
        );
      }
      checksumVerified = true;
      this.logger.log(`Checksum verified from manifest for ${repository}@${release.version}`);
    }

    // 8. Move from staging to final workspace plugin directory
    const installPath = this.getWorkspacePluginDir(workspaceId, manifest.id);
    try {
      // Remove existing installation if any
      await rm(installPath, { recursive: true, force: true });
      await mkdir(resolve(installPath, '..'), { recursive: true });

      // Attempt an atomic rename (same filesystem) or fall back to copy+delete
      try {
        await rename(stagingDir, installPath);
      } catch {
        // Cross-device move: copy then clean up staging
        await cp(stagingDir, installPath, { recursive: true });
        await rm(stagingDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Rollback: clean up both staging and partial install
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      await rm(installPath, { recursive: true, force: true }).catch(() => {});
      throw new InternalServerErrorException(
        `Failed to install plugin to workspace: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(`Plugin ${manifest.id}@${manifest.version} installed to ${installPath}`);

    return {
      manifest,
      installPath,
      checksum,
      checksumVerified,
      version: release.version,
    };
  }

  /**
   * Check if a newer version is available for a plugin.
   */
  async checkForUpdate(
    pluginId: string,
    repository: string,
    currentVersion: string,
    githubToken?: string,
  ): Promise<PluginUpdateInfo> {
    const token = githubToken ?? this.defaultGithubToken;

    try {
      const release = await this.fetchLatestRelease(repository, token);

      return {
        pluginId,
        repository,
        currentVersion,
        latestVersion: release.version,
        updateAvailable: this.isNewerVersion(currentVersion, release.version),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to check for updates for ${repository}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        pluginId,
        repository,
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
      };
    }
  }

  /**
   * Parse a plugin manifest from an already-extracted directory.
   */
  async parseManifest(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = join(pluginDir, PLUGIN_MANIFEST_FILENAME);

    let raw: string;
    try {
      raw = await readFile(manifestPath, 'utf-8');
    } catch {
      throw new BadRequestException(
        `Plugin package is missing ${PLUGIN_MANIFEST_FILENAME}. ` +
          'Every plugin must include a plugin.json manifest at the package root.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException(`${PLUGIN_MANIFEST_FILENAME} contains invalid JSON.`);
    }

    return this.validateManifest(parsed);
  }

  /**
   * Check if a cached version of a plugin exists on disk.
   */
  async isCached(repository: string, version: string): Promise<boolean> {
    const dir = this.getCacheInstallDir(repository, version);
    try {
      const stats = await stat(dir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the filesystem path where a plugin version is cached.
   */
  getCacheInstallDir(repository: string, version: string): string {
    const [owner, repo] = repository.split('/');
    return join(this.cacheRoot, owner ?? '', repo ?? '', version);
  }

  /**
   * Get the filesystem path for a plugin in a workspace.
   */
  getWorkspacePluginDir(workspaceId: string, pluginId: string): string {
    return join(this.storageRoot, workspaceId, 'plugins', pluginId);
  }

  /**
   * List all locally cached plugin versions.
   */
  async listCachedVersions(repository: string): Promise<string[]> {
    const [owner, repo] = repository.split('/');
    const repoDir = join(this.cacheRoot, owner ?? '', repo ?? '');

    try {
      const entries = await readdir(repoDir);
      return entries.sort();
    } catch {
      return [];
    }
  }

  /**
   * Invalidate the ValKey cache for a repository's releases.
   */
  async invalidateCache(repository: string): Promise<void> {
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) return;

    const latestKey = buildReleaseCacheKey(owner, repo);
    await this.valkey.del(latestKey);
    this.logger.debug(`Invalidated release cache for ${repository}`);
  }

  // -- GitHub API -------------------------------------------------------------

  /**
   * Fetch the latest non-prerelease GitHub release for a repository.
   * Results are cached in ValKey for 1 hour.
   */
  async fetchLatestRelease(repository: string, token?: string): Promise<GitHubRelease> {
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new BadRequestException(
        `Invalid repository format: "${repository}". Expected "owner/repo".`,
      );
    }

    const effectiveToken = token ?? this.defaultGithubToken;
    const cacheKey = buildReleaseCacheKey(owner, repo);

    // Try ValKey cache first
    const cached = await this.getCachedRelease(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${repository} latest release`);
      return cached;
    }

    const url = `${GITHUB_API_BASE}/repos/${repository}/releases/latest`;
    const data = await this.githubApiGetWithRetry(url, effectiveToken);
    const release = this.parseReleaseResponse(data);

    // Cache the result
    await this.cacheRelease(cacheKey, release);

    return release;
  }

  /**
   * Fetch a specific GitHub release by tag.
   * Tries both "vX.Y.Z" and "X.Y.Z" tag formats.
   * Results are cached in ValKey for 1 hour.
   */
  async fetchReleaseByTag(
    repository: string,
    version: string,
    token?: string,
  ): Promise<GitHubRelease> {
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new BadRequestException(
        `Invalid repository format: "${repository}". Expected "owner/repo".`,
      );
    }

    const effectiveToken = token ?? this.defaultGithubToken;
    const cacheKey = buildReleaseCacheKey(owner, repo, version);

    // Try ValKey cache first
    const cached = await this.getCachedRelease(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${repository}@${version}`);
      return cached;
    }

    const tagsToTry = version.startsWith('v')
      ? [version, version.slice(1)]
      : [`v${version}`, version];

    for (const tag of tagsToTry) {
      try {
        const url = `${GITHUB_API_BASE}/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
        const data = await this.githubApiGetWithRetry(url, effectiveToken);
        const release = this.parseReleaseResponse(data);

        // Cache the result
        await this.cacheRelease(cacheKey, release);

        return release;
      } catch (error) {
        if (error instanceof NotFoundException) {
          continue;
        }
        throw error;
      }
    }

    throw new NotFoundException(
      `No release found for ${repository} with version ${version}. ` +
        'Tried both vX.Y.Z and X.Y.Z tag formats.',
    );
  }

  // -- Download and Extract ---------------------------------------------------

  /**
   * Download a release .zip asset to the local cache directory.
   * Returns the path to the downloaded file.
   */
  private async downloadAsset(
    repository: string,
    version: string,
    asset: GitHubReleaseAsset,
    token?: string,
  ): Promise<string> {
    const [owner, repo] = repository.split('/');
    const cacheDir = join(this.cacheRoot, owner ?? '', repo ?? '', version);
    await mkdir(cacheDir, { recursive: true });

    const zipPath = join(cacheDir, `${repo ?? 'plugin'}.zip`);

    this.logger.log(
      `Downloading ${asset.name} (${(asset.size / 1024).toFixed(0)} KB) for ${repository}@${version}`,
    );

    const headers: Record<string, string> = {
      Accept: 'application/octet-stream',
      'User-Agent': 'Notesaner-Server/1.0',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.fetchWithRetry(asset.browserDownloadUrl, {
      headers,
      signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to download plugin asset: HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new InternalServerErrorException(
        'GitHub returned an empty response body for the plugin asset.',
      );
    }

    // Stream the response body to disk
    const nodeReadable = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
    const writeStream = createWriteStream(zipPath);
    await pipeline(nodeReadable, writeStream);

    this.logger.log(`Downloaded to ${zipPath}`);
    return zipPath;
  }

  /**
   * Extract a .zip file into a staging directory for validation.
   * Returns the resolved path to the extracted plugin root.
   *
   * On failure, the staging directory is cleaned up (rollback).
   */
  private async extractToStaging(
    _repository: string,
    _version: string,
    zipPath: string,
  ): Promise<string> {
    const stagingDir = join(
      this.cacheRoot,
      '.staging',
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await mkdir(stagingDir, { recursive: true });

    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    try {
      // Use system unzip; -o overwrites without prompting, -d sets target directory
      await execAsync(`unzip -o -q "${zipPath}" -d "${stagingDir}"`, {
        timeout: 60_000,
      });
    } catch (error) {
      // Rollback: clean up the staging directory
      await rm(stagingDir, { recursive: true, force: true });
      throw new InternalServerErrorException(
        `Failed to extract plugin archive: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Resolve nested directory structure (common GitHub zip pattern)
    const resolvedDir = await this.resolveExtractedRoot(stagingDir);

    // Clean up the .zip file after successful extraction
    await rm(zipPath, { force: true });

    return resolvedDir;
  }

  /**
   * If the extracted directory contains exactly one subdirectory and
   * no other files, treat that subdirectory as the plugin root.
   * This handles the common GitHub release pattern of
   * `repo-name-v1.0.0/plugin.json`.
   */
  private async resolveExtractedRoot(dir: string): Promise<string> {
    const entries = await readdir(dir, { withFileTypes: true });

    // Check if plugin.json is directly present
    const hasManifest = entries.some((e) => e.isFile() && e.name === PLUGIN_MANIFEST_FILENAME);

    if (hasManifest) {
      return dir;
    }

    // If there's exactly one subdirectory, descend into it
    const subdirs = entries.filter((e) => e.isDirectory());
    if (subdirs.length === 1 && subdirs[0]) {
      const nested = join(dir, subdirs[0].name);
      try {
        await stat(join(nested, PLUGIN_MANIFEST_FILENAME));
        return nested;
      } catch {
        // Fall through to return the original dir
      }
    }

    return dir;
  }

  // -- Checksum ---------------------------------------------------------------

  /**
   * Compute SHA-256 hash of a file on disk.
   */
  private async computeSha256(filePath: string): Promise<string> {
    return new Promise<string>((resolveHash, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolveHash(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  // -- Version Comparison -----------------------------------------------------

  /**
   * Simple semver comparison: returns true if latest > current.
   * Only compares major.minor.patch; pre-release suffixes are ignored.
   */
  private isNewerVersion(current: string, latest: string): boolean {
    const parseParts = (v: string): number[] => {
      const base = v.replace(/^v/, '').split('-')[0] ?? v;
      return base.split('.').map(Number);
    };

    const currentParts = parseParts(current);
    const latestParts = parseParts(latest);

    for (let i = 0; i < 3; i++) {
      const c = currentParts[i] ?? 0;
      const l = latestParts[i] ?? 0;
      if (l > c) return true;
      if (l < c) return false;
    }

    return false;
  }

  // -- ValKey Caching ---------------------------------------------------------

  /**
   * Retrieve a cached GitHub release from ValKey.
   * Returns null on cache miss or parse failure.
   */
  private async getCachedRelease(cacheKey: string): Promise<GitHubRelease | null> {
    try {
      const raw = await this.valkey.get(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as GitHubRelease;
    } catch {
      return null;
    }
  }

  /**
   * Store a GitHub release in ValKey with the configured TTL.
   */
  private async cacheRelease(cacheKey: string, release: GitHubRelease): Promise<void> {
    try {
      await this.valkey.set(cacheKey, JSON.stringify(release), RELEASE_CACHE_TTL_SECONDS);
    } catch (error) {
      // Cache write failure is non-fatal; log and continue
      this.logger.warn(
        `Failed to cache release data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // -- GitHub API Helpers with Retry ------------------------------------------

  /**
   * Perform a GitHub API GET request with exponential backoff retry
   * on transient errors (429 Too Many Requests, 503 Service Unavailable).
   */
  private async githubApiGetWithRetry(
    url: string,
    token?: string,
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Notesaner-Server/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS),
        });

        // Handle rate limiting (429) — retry after the indicated delay
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : BACKOFF_BASE_MS * Math.pow(2, attempt);

          if (attempt < MAX_RETRIES) {
            this.logger.warn(
              `GitHub API rate limited (429). Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );
            await sleep(Math.min(waitMs, 60_000)); // cap at 60s
            continue;
          }

          throw new ServiceUnavailableException(
            'GitHub API rate limit exceeded after retries. ' +
              'Configure GITHUB_TOKEN to increase the rate limit (5000/hr vs 60/hr).',
          );
        }

        // Handle 503 — transient server error, retry
        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
            this.logger.warn(
              `GitHub API returned 503. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );
            await sleep(waitMs);
            continue;
          }

          throw new ServiceUnavailableException(
            'GitHub API is temporarily unavailable (503). Please try again later.',
          );
        }

        // 404 — resource not found, do not retry
        if (response.status === 404) {
          throw new NotFoundException(
            `GitHub resource not found: ${url}. Ensure the repository exists and has public releases.`,
          );
        }

        // 403 — could be rate limit exhausted or permission issue
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            const resetTime = response.headers.get('x-ratelimit-reset');
            throw new ServiceUnavailableException(
              `GitHub API rate limit exhausted. Resets at ${resetTime ? new Date(Number(resetTime) * 1000).toISOString() : 'unknown'}. ` +
                'Configure GITHUB_TOKEN to increase the rate limit.',
            );
          }
          throw new InternalServerErrorException(
            'GitHub API returned 403 Forbidden. Check GITHUB_TOKEN permissions.',
          );
        }

        // Any other non-2xx status
        if (!response.ok) {
          throw new InternalServerErrorException(
            `GitHub API error: HTTP ${response.status} ${response.statusText}`,
          );
        }

        return (await response.json()) as Record<string, unknown>;
      } catch (error) {
        // If it is one of our NestJS exceptions, rethrow immediately
        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException ||
          error instanceof InternalServerErrorException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        // Network errors or timeouts — retry
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES) {
          const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `GitHub API request failed: ${lastError.message}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await sleep(waitMs);
          continue;
        }
      }
    }

    throw new InternalServerErrorException(
      `GitHub API request failed after ${MAX_RETRIES} retries: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  /**
   * Fetch with retry for asset downloads (429/503/network errors).
   */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, init);

        if (response.status === 429 || response.status === 503) {
          if (attempt < MAX_RETRIES) {
            const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
            this.logger.warn(
              `Download request returned ${response.status}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );
            await sleep(waitMs);
            continue;
          }
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES) {
          const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Download request failed: ${lastError.message}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await sleep(waitMs);
          continue;
        }
      }
    }

    throw new InternalServerErrorException(
      `Download failed after ${MAX_RETRIES} retries: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  /**
   * Parse the raw GitHub release JSON into our typed structure.
   */
  private parseReleaseResponse(data: Record<string, unknown>): GitHubRelease {
    const tagName = String(data['tag_name'] ?? '');
    const assets = Array.isArray(data['assets']) ? data['assets'] : [];

    const parsedAssets: GitHubReleaseAsset[] = assets.map((a: Record<string, unknown>) => ({
      name: String(a['name'] ?? ''),
      browserDownloadUrl: String(a['browser_download_url'] ?? ''),
      size: Number(a['size'] ?? 0),
      contentType: String(a['content_type'] ?? ''),
    }));

    // Find the .zip asset -- prefer one named "plugin.zip" or fallback to
    // any .zip file.
    const zipAsset =
      parsedAssets.find((a) => a.name === 'plugin.zip') ??
      parsedAssets.find((a) => a.name.endsWith('.zip')) ??
      null;

    return {
      tagName,
      version: extractVersion(tagName),
      name: String(data['name'] ?? ''),
      body: String(data['body'] ?? ''),
      prerelease: Boolean(data['prerelease']),
      publishedAt: String(data['published_at'] ?? ''),
      assets: parsedAssets,
      zipAsset,
    };
  }

  // -- Manifest Validation ----------------------------------------------------

  /**
   * Validate the parsed manifest object and return a typed PluginManifest.
   * This is a runtime check -- the shape must match what plugins provide.
   */
  private validateManifest(parsed: unknown): PluginManifest {
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('plugin.json must be a JSON object.');
    }

    const obj = parsed as Record<string, unknown>;

    const requiredStrings: Array<keyof PluginManifest> = [
      'id',
      'name',
      'description',
      'version',
      'minSdkVersion',
      'repository',
      'author',
      'main',
    ];

    for (const field of requiredStrings) {
      if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
        throw new BadRequestException(
          `plugin.json is missing required field "${field}" (must be a non-empty string).`,
        );
      }
    }

    // Validate the id format (reverse-domain or kebab-case)
    const id = obj['id'] as string;
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new BadRequestException(
        `plugin.json "id" contains invalid characters. ` +
          'Only alphanumeric, dots, hyphens, and underscores are allowed.',
      );
    }

    // Validate optional arrays
    if (obj['keywords'] !== undefined) {
      if (
        !Array.isArray(obj['keywords']) ||
        !obj['keywords'].every((k: unknown) => typeof k === 'string')
      ) {
        throw new BadRequestException('plugin.json "keywords" must be an array of strings.');
      }
    }

    return {
      id: obj['id'] as string,
      name: obj['name'] as string,
      description: obj['description'] as string,
      version: obj['version'] as string,
      minSdkVersion: obj['minSdkVersion'] as string,
      repository: obj['repository'] as string,
      author: obj['author'] as string,
      main: obj['main'] as string,
      license: typeof obj['license'] === 'string' ? obj['license'] : undefined,
      icon: typeof obj['icon'] === 'string' ? obj['icon'] : undefined,
      keywords: Array.isArray(obj['keywords']) ? (obj['keywords'] as string[]) : undefined,
      checksum: typeof obj['checksum'] === 'string' ? obj['checksum'] : undefined,
      configSchema:
        obj['configSchema'] && typeof obj['configSchema'] === 'object'
          ? (obj['configSchema'] as Record<string, unknown>)
          : undefined,
    };
  }
}
