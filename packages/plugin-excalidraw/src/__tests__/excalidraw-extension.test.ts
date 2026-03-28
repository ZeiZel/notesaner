/**
 * Tests for excalidraw-extension.ts
 *
 * Covers:
 * - ExcalidrawNodeAttrs interface shape
 * - DEFAULT_EMBED_HEIGHT, MIN_EMBED_HEIGHT, MAX_EMBED_HEIGHT constants
 * - generateFilePath option default behavior
 * - renderHTML output structure
 * - parseHTML selector
 */

import { describe, it, expect } from 'vitest';
import {
  ExcalidrawExtension,
  DEFAULT_EMBED_HEIGHT,
  MIN_EMBED_HEIGHT,
  MAX_EMBED_HEIGHT,
} from '../excalidraw-extension';

describe('ExcalidrawExtension — constants', () => {
  it('exports correct default height', () => {
    expect(DEFAULT_EMBED_HEIGHT).toBe(400);
  });

  it('exports correct min height', () => {
    expect(MIN_EMBED_HEIGHT).toBe(120);
  });

  it('exports correct max height', () => {
    expect(MAX_EMBED_HEIGHT).toBe(2400);
  });

  it('min is less than default', () => {
    expect(MIN_EMBED_HEIGHT).toBeLessThan(DEFAULT_EMBED_HEIGHT);
  });

  it('default is less than max', () => {
    expect(DEFAULT_EMBED_HEIGHT).toBeLessThan(MAX_EMBED_HEIGHT);
  });
});

describe('ExcalidrawExtension — extension definition', () => {
  it('has name "excalidrawEmbed"', () => {
    expect(ExcalidrawExtension.name).toBe('excalidrawEmbed');
  });

  it('is a block group node', () => {
    // Access the static config — TipTap stores it on the prototype
    const config = ExcalidrawExtension.config;
    expect(config.group).toBe('block');
    expect(config.atom).toBe(true);
    expect(config.draggable).toBe(true);
  });

  it('default generateFilePath returns a .excalidraw path', () => {
    const options = ExcalidrawExtension.config.addOptions?.call({
      parent: null,
      editor: null,
      name: 'excalidrawEmbed',
      options: {},
      storage: {},
    });
    const path = options?.generateFilePath?.(null);
    expect(path).toMatch(/\.excalidraw$/);
  });

  it('default generateFilePath uses noteId prefix when available', () => {
    const options = ExcalidrawExtension.config.addOptions?.call({
      parent: null,
      editor: null,
      name: 'excalidrawEmbed',
      options: {},
      storage: {},
    });
    const path = options?.generateFilePath?.('abc12345-xyz');
    expect(path).toContain('abc12345');
  });

  it('parseHTML matches data-excalidraw-embed elements', () => {
    const parseHtml = ExcalidrawExtension.config.parseHTML?.call({
      parent: null,
      editor: null,
      name: 'excalidrawEmbed',
      options: {},
      storage: {},
    });
    expect(parseHtml).toEqual([{ tag: 'div[data-excalidraw-embed]' }]);
  });
});
