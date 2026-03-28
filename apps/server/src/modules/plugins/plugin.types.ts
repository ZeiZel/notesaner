/**
 * Plugin manifest as expected in `plugin.json` inside a plugin .zip package.
 *
 * This is the server-side representation. The plugin-sdk will eventually expose
 * a matching type for plugin authors.
 */
export interface PluginManifest {
  /** Unique plugin identifier (reverse-domain, e.g. "io.notesaner.focus-mode") */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description */
  description: string;
  /** Semver version string */
  version: string;
  /** Minimum plugin-sdk version required */
  minSdkVersion: string;
  /** GitHub repository in owner/repo format */
  repository: string;
  /** Plugin author name */
  author: string;
  /** SPDX license identifier */
  license?: string;
  /** Relative path to the main entry bundle inside the package */
  main: string;
  /** Optional icon path (relative to package root) */
  icon?: string;
  /** Keywords for registry search */
  keywords?: string[];
  /** Plugin configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
}

/**
 * Represents a single asset attached to a GitHub release.
 */
export interface GitHubReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string;
}

/**
 * Parsed GitHub release metadata.
 */
export interface GitHubRelease {
  tagName: string;
  /** Semver version extracted from tag (strips leading 'v') */
  version: string;
  name: string;
  body: string;
  prerelease: boolean;
  publishedAt: string;
  assets: GitHubReleaseAsset[];
  /** The .zip asset selected for download (null if none found) */
  zipAsset: GitHubReleaseAsset | null;
}

/**
 * Result of a successful plugin installation.
 */
export interface PluginInstallResult {
  manifest: PluginManifest;
  /** Absolute path where the plugin was extracted on the filesystem */
  installPath: string;
  /** SHA-256 checksum of the downloaded .zip */
  checksum: string;
  /** Whether the checksum was verified against a user-provided value */
  checksumVerified: boolean;
  /** The GitHub release version installed */
  version: string;
}

/**
 * Result of an auto-update check for a single plugin.
 */
export interface PluginUpdateInfo {
  pluginId: string;
  repository: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}
