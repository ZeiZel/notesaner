import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { watch, type FSWatcher } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import type { PluginManifest } from './plugin.types';

// ── Constants ────────────────────────────────────────────────────────────────

const PLUGIN_MANIFEST_FILENAME = 'plugin.json';
const DEBOUNCE_MS = 500;
const WATCHED_EXTENSIONS = /\.(ts|js|json|css|html|svelte|vue)$/;

// ── Types ────────────────────────────────────────────────────────────────────

export interface PluginChangeEvent {
  /** Type of change detected */
  type: 'manifest-changed' | 'code-changed' | 'plugin-added' | 'plugin-removed';
  /** Absolute path of the changed file */
  filePath: string;
  /** Relative path from the watched plugins root */
  relativePath: string;
  /** Plugin directory name (immediate child of the plugins root) */
  pluginDir: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Updated manifest if available (only for manifest-changed and plugin-added) */
  manifest?: PluginManifest;
}

export type PluginChangeListener = (event: PluginChangeEvent) => void;

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Watches plugin directories for file changes in development mode.
 *
 * When a file change is detected:
 *  1. The change is debounced (300 ms) to avoid rapid-fire events.
 *  2. If the changed file is `plugin.json`, the manifest is re-parsed.
 *  3. All registered listeners are notified (primarily the PluginWatcherGateway).
 *
 * This service is only active when `NODE_ENV === 'development'`.
 * In production it is a no-op to avoid unnecessary filesystem overhead.
 */
@Injectable()
export class HotReloadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotReloadService.name);
  private readonly isDevelopment: boolean;
  private readonly pluginsRoot: string;
  private watcher: FSWatcher | null = null;
  private readonly listeners = new Set<PluginChangeListener>();

  /**
   * Debounce timers keyed by plugin directory name.
   * Each timer fires the change event after DEBOUNCE_MS of inactivity.
   */
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Pending events per plugin dir, accumulated during the debounce window.
   * When the timer fires, the most significant event is emitted.
   */
  private readonly pendingEvents = new Map<string, PluginChangeEvent>();

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    this.isDevelopment = nodeEnv === 'development';

    const storageRoot = this.config.get<string>('storage.root', '/var/lib/notesaner/workspaces');
    this.pluginsRoot = resolve(storageRoot, '..', 'plugins-dev');
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    if (!this.isDevelopment) {
      this.logger.log('Hot reload is disabled (not in development mode)');
      return;
    }

    await this.startWatching();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopWatching();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a callback that will be invoked on plugin file changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: PluginChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the root directory being watched.
   */
  getPluginsRoot(): string {
    return this.pluginsRoot;
  }

  /**
   * Whether the watcher is currently active.
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }

  // ── Watcher Setup ──────────────────────────────────────────────────────────

  private async startWatching(): Promise<void> {
    // Ensure the plugins-dev directory exists
    const { mkdir } = await import('node:fs/promises');
    await mkdir(this.pluginsRoot, { recursive: true });

    this.logger.log(`Starting plugin hot-reload watcher on: ${this.pluginsRoot}`);

    this.watcher = watch(this.pluginsRoot, {
      persistent: true,
      ignoreInitial: true,
      depth: 5,
      // Ignore common non-source directories and files
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.DS_Store', '**/thumbs.db'],
      // Wait for writes to finish
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watcher
      .on('add', (filePath) => this.handleFileEvent('add', filePath))
      .on('change', (filePath) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath))
      .on('addDir', (dirPath) => this.handleDirEvent('addDir', dirPath))
      .on('unlinkDir', (dirPath) => this.handleDirEvent('unlinkDir', dirPath))
      .on('error', (error: unknown) => {
        this.logger.error(
          `Watcher error: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .on('ready', () => {
        this.logger.log('Plugin hot-reload watcher is ready');
      });
  }

  private async stopWatching(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingEvents.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.logger.log('Plugin hot-reload watcher stopped');
    }
  }

  // ── Event Handling ─────────────────────────────────────────────────────────

  private handleFileEvent(fsEvent: 'add' | 'change' | 'unlink', filePath: string): void {
    // Filter to only relevant file types
    if (!WATCHED_EXTENSIONS.test(filePath)) {
      return;
    }

    const relPath = relative(this.pluginsRoot, filePath);
    const pluginDir = relPath.split('/')[0] ?? relPath.split('\\')[0] ?? '';

    if (!pluginDir) {
      return;
    }

    const isManifest = filePath.endsWith(PLUGIN_MANIFEST_FILENAME);
    let eventType: PluginChangeEvent['type'];

    if (fsEvent === 'add' && isManifest) {
      eventType = 'plugin-added';
    } else if (fsEvent === 'unlink' && isManifest) {
      eventType = 'plugin-removed';
    } else if (isManifest) {
      eventType = 'manifest-changed';
    } else {
      eventType = 'code-changed';
    }

    const event: PluginChangeEvent = {
      type: eventType,
      filePath,
      relativePath: relPath,
      pluginDir,
      timestamp: new Date().toISOString(),
    };

    this.debounceAndEmit(pluginDir, event);
  }

  private handleDirEvent(fsEvent: 'addDir' | 'unlinkDir', dirPath: string): void {
    const relPath = relative(this.pluginsRoot, dirPath);
    const parts = relPath.split('/');

    // Only care about top-level plugin directories
    if (parts.length !== 1 || !parts[0]) {
      return;
    }

    const pluginDir = parts[0];
    const eventType: PluginChangeEvent['type'] =
      fsEvent === 'addDir' ? 'plugin-added' : 'plugin-removed';

    const event: PluginChangeEvent = {
      type: eventType,
      filePath: dirPath,
      relativePath: relPath,
      pluginDir,
      timestamp: new Date().toISOString(),
    };

    this.debounceAndEmit(pluginDir, event);
  }

  /**
   * Debounce events per plugin directory.
   * If multiple file changes happen within DEBOUNCE_MS, only the most
   * significant event is emitted (manifest > code changes).
   */
  private debounceAndEmit(pluginDir: string, event: PluginChangeEvent): void {
    // Priority: manifest-changed > plugin-added > plugin-removed > code-changed
    const existing = this.pendingEvents.get(pluginDir);
    const priority: Record<PluginChangeEvent['type'], number> = {
      'manifest-changed': 3,
      'plugin-added': 2,
      'plugin-removed': 2,
      'code-changed': 1,
    };

    if (!existing || priority[event.type] >= priority[existing.type]) {
      this.pendingEvents.set(pluginDir, event);
    }

    // Reset the timer for this plugin directory
    const existingTimer = this.debounceTimers.get(pluginDir);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(pluginDir);
      const pendingEvent = this.pendingEvents.get(pluginDir);
      this.pendingEvents.delete(pluginDir);

      if (pendingEvent) {
        void this.emitEvent(pendingEvent);
      }
    }, DEBOUNCE_MS);

    this.debounceTimers.set(pluginDir, timer);
  }

  /**
   * Emit a change event to all registered listeners.
   * Attempts to parse the manifest for manifest-related events.
   */
  private async emitEvent(event: PluginChangeEvent): Promise<void> {
    // Attempt to read the manifest for relevant event types
    if (event.type === 'manifest-changed' || event.type === 'plugin-added') {
      try {
        const manifestPath = join(this.pluginsRoot, event.pluginDir, PLUGIN_MANIFEST_FILENAME);
        const raw = await readFile(manifestPath, 'utf-8');
        event.manifest = JSON.parse(raw) as PluginManifest;
      } catch {
        this.logger.warn(
          `Could not read manifest for plugin "${event.pluginDir}" after ${event.type} event`,
        );
      }
    }

    this.logger.log(`Plugin change: ${event.type} in "${event.pluginDir}" (${event.relativePath})`);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error(
          `Listener error for ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
