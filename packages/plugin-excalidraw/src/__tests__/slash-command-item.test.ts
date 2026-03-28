/**
 * Tests for slash-command-item.ts
 *
 * Covers:
 * - EXCALIDRAW_SLASH_ITEM has the correct id, group, and keywords
 * - onSelect calls insertExcalidrawEmbed when extension is registered
 * - onSelect warns and no-ops when extension is absent
 * - onSelect warns and no-ops when no editor is found
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EXCALIDRAW_SLASH_ITEM } from '../slash-command-item';
import type { EditorView } from '@tiptap/pm/view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockView(opts: { hasExtension?: boolean; hasEditor?: boolean }): EditorView {
  const insertExcalidrawEmbed = vi.fn(() => true);
  const focus = vi.fn();

  const extensions = opts.hasExtension ? [{ name: 'excalidrawEmbed' }] : [];

  const editor = opts.hasEditor
    ? {
        extensionManager: { extensions },
        commands: { insertExcalidrawEmbed },
        view: { focus },
      }
    : null;

  return {
    props: { editor },
    state: {
      tr: { deleteRange: vi.fn().mockReturnThis() },
      doc: { content: { size: 1000 } },
    },
    dispatch: vi.fn(),
  } as unknown as EditorView;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EXCALIDRAW_SLASH_ITEM — metadata', () => {
  it('has id "excalidraw"', () => {
    expect(EXCALIDRAW_SLASH_ITEM.id).toBe('excalidraw');
  });

  it('belongs to "Advanced" group', () => {
    expect(EXCALIDRAW_SLASH_ITEM.group).toBe('Advanced');
  });

  it('has relevant keywords', () => {
    expect(EXCALIDRAW_SLASH_ITEM.keywords).toContain('whiteboard');
    expect(EXCALIDRAW_SLASH_ITEM.keywords).toContain('excalidraw');
    expect(EXCALIDRAW_SLASH_ITEM.keywords).toContain('draw');
  });

  it('has title and description', () => {
    expect(EXCALIDRAW_SLASH_ITEM.title).toBeTruthy();
    expect(EXCALIDRAW_SLASH_ITEM.description).toBeTruthy();
  });
});

describe('EXCALIDRAW_SLASH_ITEM — onSelect', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('calls insertExcalidrawEmbed when extension is registered', () => {
    const view = buildMockView({ hasEditor: true, hasExtension: true });

    const editor = (view as any).props.editor;

    EXCALIDRAW_SLASH_ITEM.onSelect(view, 5, 'excali');

    expect(editor.commands.insertExcalidrawEmbed).toHaveBeenCalled();
  });

  it('warns and no-ops when ExcalidrawExtension is not registered', () => {
    const view = buildMockView({ hasEditor: true, hasExtension: false });
    const warnSpy = vi.spyOn(console, 'warn');

    EXCALIDRAW_SLASH_ITEM.onSelect(view, 5, 'excali');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ExcalidrawExtension'));
  });

  it('warns and no-ops when no editor is found on the view', () => {
    const view = buildMockView({ hasEditor: false });
    const warnSpy = vi.spyOn(console, 'warn');

    EXCALIDRAW_SLASH_ITEM.onSelect(view, 5, 'excali');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No editor found'));
  });
});
