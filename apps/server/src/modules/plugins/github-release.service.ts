import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type {
  GitHubRelease,
  GitHubReleaseAsset,
  PluginManifest,
  PluginInstallResult,
  PluginUpdateInfo,
} from './plugin.types';

// ── Constants ────────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com';
const PLUGIN_MANIFEST_FILENAME = 'plugin.json';
const PLUGIN_CACHE_DIR_NAME = '.plugin-cache';
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB safety limit
const GITHUB_API_TIMEOUT_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract semver from a GitHub tag name.
 * Handles tags like "v1.2.3", "1.2.3", "v1.0.0-beta.1".
 */
function extractVersion(tagName: string): string {
  return tagName.replace(/^v/, '');
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GitHubReleaseService {
  private readonly logger = new Logger(GitHubReleaseService.name);
  private readonly githubToken: string | undefined;
  private readonly storageRoot: string;
  private readonly cacheRoot: string;

  constructor(private readonly config: ConfigService) {
    this.githubToken = this.config.get<string>('github.token');
    this.storageRoot = this.config.get<string>('storage.root', '/var/lib/notesaner/workspaces');
    this.cacheRoot = resolve(this.storageRoot, '..', PLUGIN_CACHE_DIR_NAME);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Install a plugin from a GitHub release.
   *
   * 1. Fetch the specified release (or latest) from GitHub.
   * 2. Download the .zip asset.
   * 3. Verify checksum (if provided).
   * 4. Extract to the plugin cache directory.
   * 5. Parse and validate the plugin manifest.
   * 6. Return the install result.
   */
  async installFromGitHub(
    repository: string,
    version?: string,
    expectedChecksum?: string,
  ): Promise<PluginInstallResult> {
    this.logger.log(`Installing plugin from ${repository}${version ? `@${version}` : ' (latest)'}`);

    // 1. Fetch release metadata
    const release = version
      ? await this.fetchReleaseByTag(repository, version)
      : await this.fetchLatestRelease(repository);

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
    const zipPath = await this.downloadAsset(repository, release.version, release.zipAsset);

    // 4. Compute and verify checksum
    const checksum = await this.computeSha256(zipPath);
    let checksumVerified = false;

    if (expectedChecksum) {
      if (checksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        // Clean up the downloaded file on checksum mismatch
        await rm(zipPath, { force: true });
        throw new BadRequestException(
          `Checksum mismatch. Expected: ${expectedChecksum}, got: ${checksum}. ` +
            'The downloaded file has been discarded for security.',
        );
      }
      checksumVerified = true;
      this.logger.log(`Checksum verified for ${repository}@${release.version}`);
    }

    // 5. Extract the archive
    const installPath = await this.extractZip(repository, release.version, zipPath);

    // 6. Parse manifest
    const manifest = await this.parseManifest(installPath);

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
  ): Promise<PluginUpdateInfo> {
    try {
      const release = await this.fetchLatestRelease(repository);

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
    const dir = this.getInstallDir(repository, version);
    try {
      const stats = await stat(dir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the filesystem path where a plugin version is stored.
   */
  getInstallDir(repository: string, version: string): string {
    const [owner, repo] = repository.split('/');
    return join(this.cacheRoot, owner ?? '', repo ?? '', version);
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

  // ── GitHub API ─────────────────────────────────────────────────────────────

  /**
   * Fetch the latest non-prerelease GitHub release for a repository.
   */
  async fetchLatestRelease(repository: string): Promise<GitHubRelease> {
    const url = `${GITHUB_API_BASE}/repos/${repository}/releases/latest`;
    const data = await this.githubApiGet(url);
    return this.parseReleaseResponse(data);
  }

  /**
   * Fetch a specific GitHub release by tag.
   * Tries both "vX.Y.Z" and "X.Y.Z" tag formats.
   */
  async fetchReleaseByTag(repository: string, version: string): Promise<GitHubRelease> {
    const tagsToTry = version.startsWith('v')
      ? [version, version.slice(1)]
      : [`v${version}`, version];

    for (const tag of tagsToTry) {
      try {
        const url = `${GITHUB_API_BASE}/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
        const data = await this.githubApiGet(url);
        return this.parseReleaseResponse(data);
      } catch (error) {
        // If it's a 404, try next tag format. Otherwise rethrow.
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

  // ── Download and Extract ───────────────────────────────────────────────────

  /**
   * Download a release .zip asset to the local cache directory.
   * Returns the path to the downloaded file.
   */
  private async downloadAsset(
    repository: string,
    version: string,
    asset: GitHubReleaseAsset,
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
    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }

    const response = await fetch(asset.browserDownloadUrl, {
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
   * Extract a .zip file into the plugin installation directory.
   * Uses Node.js built-in unzip via a child process for security
   * (no third-party zip library needed).
   */
  private async extractZip(repository: string, version: string, zipPath: string): Promise<string> {
    const installDir = this.getInstallDir(repository, version);
    await mkdir(installDir, { recursive: true });

    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    try {
      // Use system unzip; -o overwrites without prompting, -d sets target directory
      await execAsync(`unzip -o -q "${zipPath}" -d "${installDir}"`, {
        timeout: 60_000,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to extract plugin archive: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Some GitHub release zips contain a single top-level directory.
    // If that's the case, use the nested directory as the install root.
    const resolvedDir = await this.resolveExtractedRoot(installDir);

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

  // ── Checksum ───────────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 hash of a file on disk.
   */
  private async computeSha256(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  // ── Version Comparison ─────────────────────────────────────────────────────

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

  // ── GitHub API Helpers ─────────────────────────────────────────────────────

  private async githubApiGet(url: string): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Notesaner-Server/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS),
    });

    if (response.status === 404) {
      throw new NotFoundException(
        `GitHub resource not found: ${url}. Ensure the repository exists and has public releases.`,
      );
    }

    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        throw new InternalServerErrorException(
          `GitHub API rate limit exceeded. Resets at ${resetTime ? new Date(Number(resetTime) * 1000).toISOString() : 'unknown'}. ` +
            'Configure GITHUB_TOKEN to increase the rate limit.',
        );
      }
      throw new InternalServerErrorException(
        'GitHub API returned 403 Forbidden. Check GITHUB_TOKEN permissions.',
      );
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `GitHub API error: HTTP ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
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

    // Find the .zip asset — prefer one named "plugin.zip" or fallback to
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

  // ── Manifest Validation ────────────────────────────────────────────────────

  /**
   * Validate the parsed manifest object and return a typed PluginManifest.
   * This is a runtime check — the shape must match what plugins provide.
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
      configSchema:
        obj['configSchema'] && typeof obj['configSchema'] === 'object'
          ? (obj['configSchema'] as Record<string, unknown>)
          : undefined,
    };
  }
}
