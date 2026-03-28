import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginSandboxManagerService } from '../plugin-sandbox-manager.service';
import type { PluginManifest } from '../plugin.types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const VALID_MANIFEST: PluginManifest = {
  id: 'io.notesaner.test-plugin',
  name: 'Test Plugin',
  description: 'A test plugin',
  version: '1.0.0',
  minSdkVersion: '0.1.0',
  repository: 'notesaner/test-plugin',
  author: 'Test Author',
  main: 'dist/index.js',
};

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PluginSandboxManagerService', () => {
  let service: PluginSandboxManagerService;
  const pluginsRoot = '/var/lib/notesaner/plugins-dev';
  const pluginDir = 'test-plugin';

  beforeEach(() => {
    service = new PluginSandboxManagerService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.destroyAll();
  });

  describe('loadPlugin', () => {
    it('should load a plugin and store sandbox state', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));

      const result = await service.loadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(true);
      expect(result.pluginId).toBe('io.notesaner.test-plugin');
      expect(result.pluginDir).toBe(pluginDir);
      expect(result.manifest).toEqual(VALID_MANIFEST);
      expect(result.settingsPreserved).toBe(false);
      expect(result.reloadCount).toBe(0);

      const state = service.getSandboxState(pluginDir);
      expect(state).toBeDefined();
      expect(state?.pluginId).toBe('io.notesaner.test-plugin');
      expect(state?.manifest).toEqual(VALID_MANIFEST);
    });

    it('should return error result when manifest cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await service.loadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
      expect(result.manifest).toBeNull();
      expect(service.getSandboxState(pluginDir)).toBeUndefined();
    });

    it('should return error result when manifest is invalid JSON', async () => {
      mockReadFile.mockResolvedValue('{ invalid json');

      const result = await service.loadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(false);
      expect(result.manifest).toBeNull();
    });
  });

  describe('reloadPlugin (settings preservation)', () => {
    it('should preserve settings across reload', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));

      // Initial load
      await service.loadPlugin(pluginsRoot, pluginDir);
      service.updateSettings(pluginDir, { theme: 'dark', fontSize: 14 });

      // Reload
      const result = await service.reloadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(true);
      expect(result.settingsPreserved).toBe(true);
      expect(result.reloadCount).toBe(1);

      const settings = service.getSettings(pluginDir);
      expect(settings).toEqual({ theme: 'dark', fontSize: 14 });
    });

    it('should increment reload count on each reload', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));

      await service.loadPlugin(pluginsRoot, pluginDir);
      const r1 = await service.reloadPlugin(pluginsRoot, pluginDir);
      const r2 = await service.reloadPlugin(pluginsRoot, pluginDir);
      const r3 = await service.reloadPlugin(pluginsRoot, pluginDir);

      expect(r1.reloadCount).toBe(1);
      expect(r2.reloadCount).toBe(2);
      expect(r3.reloadCount).toBe(3);
    });

    it('should update manifest on reload when manifest changes', async () => {
      // Initial load with v1
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));
      await service.loadPlugin(pluginsRoot, pluginDir);

      // Reload with v2
      const updatedManifest = { ...VALID_MANIFEST, version: '2.0.0', name: 'Updated Plugin' };
      mockReadFile.mockResolvedValue(JSON.stringify(updatedManifest));
      const result = await service.reloadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(true);
      expect(result.manifest?.version).toBe('2.0.0');
      expect(result.manifest?.name).toBe('Updated Plugin');

      const state = service.getSandboxState(pluginDir);
      expect(state?.manifest.version).toBe('2.0.0');
    });

    it('should preserve settings even when reload fails', async () => {
      // Initial load succeeds
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));
      await service.loadPlugin(pluginsRoot, pluginDir);
      service.updateSettings(pluginDir, { keepMe: true });

      // Reload fails -- but settings should still be reported as preserved
      mockReadFile.mockRejectedValue(new Error('disk error'));
      const result = await service.reloadPlugin(pluginsRoot, pluginDir);

      expect(result.success).toBe(false);
      expect(result.settingsPreserved).toBe(true);
    });
  });

  describe('destroySandbox', () => {
    it('should remove sandbox state', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));
      await service.loadPlugin(pluginsRoot, pluginDir);

      expect(service.getSandboxState(pluginDir)).toBeDefined();
      service.destroySandbox(pluginDir);
      expect(service.getSandboxState(pluginDir)).toBeUndefined();
    });

    it('should handle destroying a non-existent sandbox gracefully', () => {
      expect(() => service.destroySandbox('nonexistent')).not.toThrow();
    });
  });

  describe('removePlugin', () => {
    it('should remove sandbox completely', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));
      await service.loadPlugin(pluginsRoot, pluginDir);

      service.removePlugin(pluginDir);
      expect(service.getSandboxState(pluginDir)).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    it('should merge new settings with existing ones', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));
      await service.loadPlugin(pluginsRoot, pluginDir);

      service.updateSettings(pluginDir, { color: 'blue' });
      service.updateSettings(pluginDir, { fontSize: 16 });

      const settings = service.getSettings(pluginDir);
      expect(settings).toEqual({ color: 'blue', fontSize: 16 });
    });

    it('should return empty settings for unloaded plugin', () => {
      expect(service.getSettings('nonexistent')).toEqual({});
    });
  });

  describe('getAllSandboxes', () => {
    it('should return all loaded sandboxes', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));

      await service.loadPlugin(pluginsRoot, 'plugin-a');
      await service.loadPlugin(pluginsRoot, 'plugin-b');

      const all = service.getAllSandboxes();
      expect(all.size).toBe(2);
      expect(all.has('plugin-a')).toBe(true);
      expect(all.has('plugin-b')).toBe(true);
    });
  });

  describe('destroyAll', () => {
    it('should destroy all sandboxes', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(VALID_MANIFEST));

      await service.loadPlugin(pluginsRoot, 'plugin-a');
      await service.loadPlugin(pluginsRoot, 'plugin-b');

      service.destroyAll();

      expect(service.getAllSandboxes().size).toBe(0);
    });
  });
});
