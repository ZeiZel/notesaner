/**
 * Tests for plugin-lifecycle.ts
 *
 * Covers:
 * - onLoad registers commands and views
 * - onLoad shows a success notification
 * - onUnload clears the active context
 * - getPluginContext returns null after onUnload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onLoad, onUnload, getPluginContext } from '../plugin-lifecycle';
import type { PluginContext } from '@notesaner/plugin-sdk';

// ---------------------------------------------------------------------------
// Mock PluginContext
// ---------------------------------------------------------------------------

function buildMockContext(): PluginContext {
  return {
    manifest: {
      id: 'notesaner.excalidraw',
      name: 'Excalidraw',
      version: '1.0.0',
      author: 'Notesaner',
      description: 'Test',
      main: 'dist/index.js',
      permissions: [],
      minAppVersion: '1.0.0',
      repository: 'notesaner/plugin-excalidraw',
    },
    workspace: { id: 'ws-1', name: 'Test', slug: 'test' },
    notes: {
      read: vi.fn(),
      write: vi.fn(),
      search: vi.fn(),
    },
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    ui: {
      showNotification: vi.fn(),
      registerCommand: vi.fn(),
      registerSidebarPanel: vi.fn(),
      registerView: vi.fn(),
    },
  } as unknown as PluginContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugin-lifecycle — onLoad', () => {
  let ctx: PluginContext;

  beforeEach(async () => {
    ctx = buildMockContext();
    await onLoad(ctx);
  });

  it('registers the excalidraw.new-drawing command', () => {
    expect(ctx.ui.registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'excalidraw.new-drawing' }),
    );
  });

  it('registers the excalidraw.whiteboard view', () => {
    expect(ctx.ui.registerView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'excalidraw.whiteboard' }),
    );
  });

  it('shows a success notification', () => {
    expect(ctx.ui.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });

  it('stores the context so getPluginContext returns it', () => {
    expect(getPluginContext()).toBe(ctx);
  });
});

describe('plugin-lifecycle — onUnload', () => {
  it('clears the active context', async () => {
    const ctx = buildMockContext();
    await onLoad(ctx);
    expect(getPluginContext()).toBe(ctx);

    await onUnload();
    expect(getPluginContext()).toBeNull();
  });
});

describe('plugin-lifecycle — new-drawing command callback', () => {
  it('emits excalidraw.insert-embed event', async () => {
    const ctx = buildMockContext();
    await onLoad(ctx);

    // Extract the registered command
    const registerCall = (ctx.ui.registerCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      ([opts]) => opts.id === 'excalidraw.new-drawing',
    );
    expect(registerCall).toBeDefined();

    const command = registerCall![0];
    await command.callback();

    expect(ctx.events.emit).toHaveBeenCalledWith(
      'excalidraw.insert-embed',
      expect.objectContaining({ filePath: expect.stringMatching(/\.excalidraw$/) }),
    );
  });
});

describe('plugin-lifecycle — view render', () => {
  it('emits excalidraw.view-ready with the container', async () => {
    const ctx = buildMockContext();
    await onLoad(ctx);

    // Extract the registered view
    const registerViewCall = (ctx.ui.registerView as ReturnType<typeof vi.fn>).mock.calls.find(
      ([opts]) => opts.id === 'excalidraw.whiteboard',
    );
    expect(registerViewCall).toBeDefined();

    const view = registerViewCall![0];
    const container = document.createElement('div');
    view.render(container);

    expect(ctx.events.emit).toHaveBeenCalledWith(
      'excalidraw.view-ready',
      expect.objectContaining({ container }),
    );
  });

  it('injects a fallback message into the container', async () => {
    const ctx = buildMockContext();
    await onLoad(ctx);

    const registerViewCall = (ctx.ui.registerView as ReturnType<typeof vi.fn>).mock.calls.find(
      ([opts]) => opts.id === 'excalidraw.whiteboard',
    );
    const view = registerViewCall![0];
    const container = document.createElement('div');
    view.render(container);

    expect(container.innerHTML).toContain('Open an Excalidraw file');
  });
});
