import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PluginManifest } from './plugin.types';

// ── Constants ────────────────────────────────────────────────────────────────

const PLUGIN_MANIFEST_FILENAME = 'plugin.json';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Represents the runtime state of a loaded plugin sandbox.
 *
 * In a full implementation, this would hold the iframe sandbox reference,
 * the postMessage channel, and the loaded bundle. For now it tracks the
 * manifest and any user-configured settings so that the hot-reload cycle
 * can tear down and re-create the sandbox while preserving settings.
 */
export interface PluginSandboxState {
  /** Plugin identifier from manifest */
  pluginId: string;
  /** Absolute path to the plugin directory on disk */
  pluginDir: string;
  /** Current parsed manifest */
  manifest: PluginManifest;
  /** User-configured plugin settings (preserved across reloads) */
  settings: Record<string, unknown>;
  /** ISO 8601 timestamp of when the sandbox was last loaded */
  loadedAt: string;
  /** Number of times this plugin has been reloaded */
  reloadCount: number;
}

/**
 * Result returned after a plugin reload cycle completes.
 */
export interface PluginReloadResult {
  pluginId: string;
  pluginDir: string;
  success: boolean;
  manifest: PluginManifest | null;
  settingsPreserved: boolean;
  reloadCount: number;
  timestamp: string;
  error?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages plugin sandbox lifecycle for hot-reload.
 *
 * Responsibilities:
 *  - Track loaded plugin sandboxes (manifest, settings, state).
 *  - Destroy a plugin sandbox (tear down runtime state).
 *  - Re-create a plugin sandbox (re-read manifest, restore settings).
 *  - Preserve plugin settings across the destroy/create cycle.
 *
 * This service is intentionally decoupled from the file watcher so it can
 * also be triggered by force-reload requests or future plugin management
 * operations.
 */
@Injectable()
export class PluginSandboxManagerService {
  private readonly logger = new Logger(PluginSandboxManagerService.name);

  /**
   * Active plugin sandboxes keyed by plugin directory name.
   * Using directory name rather than pluginId because the same directory
   * can change its manifest id during development.
   */
  private readonly sandboxes = new Map<string, PluginSandboxState>();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load a plugin sandbox from disk.
   *
   * Reads the manifest, creates runtime state, and stores it.
   * If a sandbox already exists for this directory, it is destroyed first
   * (settings are preserved).
   */
  async loadPlugin(pluginsRoot: string, pluginDir: string): Promise<PluginReloadResult> {
    const absoluteDir = join(pluginsRoot, pluginDir);
    const timestamp = new Date().toISOString();

    // Preserve existing settings if the plugin was previously loaded
    const existingState = this.sandboxes.get(pluginDir);
    const preservedSettings = existingState?.settings ?? {};

    // Destroy existing sandbox state
    if (existingState) {
      this.destroySandbox(pluginDir);
    }

    // Read and parse the manifest
    let manifest: PluginManifest;
    try {
      const manifestPath = join(absoluteDir, PLUGIN_MANIFEST_FILENAME);
      const raw = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(raw) as PluginManifest;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load plugin manifest from "${pluginDir}": ${errorMessage}`);

      return {
        pluginId: existingState?.pluginId ?? pluginDir,
        pluginDir,
        success: false,
        manifest: null,
        settingsPreserved: Object.keys(preservedSettings).length > 0,
        reloadCount: existingState?.reloadCount ?? 0,
        timestamp,
        error: errorMessage,
      };
    }

    // Create new sandbox state
    const reloadCount = (existingState?.reloadCount ?? 0) + (existingState ? 1 : 0);

    const newState: PluginSandboxState = {
      pluginId: manifest.id,
      pluginDir,
      manifest,
      settings: preservedSettings,
      loadedAt: timestamp,
      reloadCount,
    };

    this.sandboxes.set(pluginDir, newState);

    this.logger.log(
      `Plugin "${manifest.id}" loaded from "${pluginDir}" ` +
        `(reload #${reloadCount}, settings preserved: ${Object.keys(preservedSettings).length > 0})`,
    );

    return {
      pluginId: manifest.id,
      pluginDir,
      success: true,
      manifest,
      settingsPreserved: Object.keys(preservedSettings).length > 0,
      reloadCount,
      timestamp,
    };
  }

  /**
   * Reload a plugin by destroying its sandbox and re-creating it.
   *
   * This is the primary method called by the hot-reload pipeline.
   * Settings are preserved across the reload.
   */
  async reloadPlugin(pluginsRoot: string, pluginDir: string): Promise<PluginReloadResult> {
    this.logger.log(`Reloading plugin in "${pluginDir}"...`);
    return this.loadPlugin(pluginsRoot, pluginDir);
  }

  /**
   * Destroy a plugin sandbox, freeing all runtime state except settings
   * (which are preserved in memory for possible reload).
   */
  destroySandbox(pluginDir: string): void {
    const state = this.sandboxes.get(pluginDir);
    if (!state) {
      return;
    }

    this.logger.log(`Destroying sandbox for plugin "${state.pluginId}" in "${pluginDir}"`);

    // In a full implementation, this is where we would:
    //  - Terminate the iframe sandbox
    //  - Close the postMessage channel
    //  - Unload the plugin bundle from memory
    //  - Cancel any pending plugin operations

    this.sandboxes.delete(pluginDir);
  }

  /**
   * Remove a plugin completely (including settings).
   */
  removePlugin(pluginDir: string): void {
    this.destroySandbox(pluginDir);
    this.logger.log(`Plugin "${pluginDir}" removed completely`);
  }

  /**
   * Get the current state of a plugin sandbox.
   */
  getSandboxState(pluginDir: string): PluginSandboxState | undefined {
    return this.sandboxes.get(pluginDir);
  }

  /**
   * Get all loaded plugin sandboxes.
   */
  getAllSandboxes(): ReadonlyMap<string, PluginSandboxState> {
    return this.sandboxes;
  }

  /**
   * Update the settings for a specific plugin.
   * Settings persist across reloads.
   */
  updateSettings(pluginDir: string, settings: Record<string, unknown>): void {
    const state = this.sandboxes.get(pluginDir);
    if (!state) {
      this.logger.warn(`Cannot update settings for unloaded plugin "${pluginDir}"`);
      return;
    }

    state.settings = { ...state.settings, ...settings };
    this.logger.debug(`Settings updated for plugin "${state.pluginId}" in "${pluginDir}"`);
  }

  /**
   * Get the settings for a specific plugin.
   */
  getSettings(pluginDir: string): Record<string, unknown> {
    return this.sandboxes.get(pluginDir)?.settings ?? {};
  }

  /**
   * Destroy all sandboxes. Called during module teardown.
   */
  destroyAll(): void {
    for (const pluginDir of this.sandboxes.keys()) {
      this.destroySandbox(pluginDir);
    }
    this.logger.log('All plugin sandboxes destroyed');
  }
}
