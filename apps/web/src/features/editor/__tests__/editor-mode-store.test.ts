import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorModeStore } from '../editor-mode-store';

/**
 * Tests for the editor-mode-store.
 *
 * We test the Zustand store directly by calling actions and verifying state.
 * The store is reset before each test to ensure isolation.
 */

describe('useEditorModeStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test.
    const store = useEditorModeStore.getState();
    store.setMode('wysiwyg');
    store.setMarkdown('');
    store.resetReadingSettings();
  });

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  describe('setMode', () => {
    it('should set mode to source', () => {
      useEditorModeStore.getState().setMode('source');
      expect(useEditorModeStore.getState().mode).toBe('source');
      expect(useEditorModeStore.getState().lastEditMode).toBe('source');
    });

    it('should set mode to preview', () => {
      useEditorModeStore.getState().setMode('preview');
      expect(useEditorModeStore.getState().mode).toBe('preview');
      expect(useEditorModeStore.getState().lastEditMode).toBe('preview');
    });

    it('should enter reading mode and preserve lastEditMode', () => {
      useEditorModeStore.getState().setMode('source');
      useEditorModeStore.getState().setMode('reading');

      const state = useEditorModeStore.getState();
      expect(state.mode).toBe('reading');
      expect(state.lastEditMode).toBe('source');
    });

    it('should preserve lastEditMode when already in reading mode and setting reading again', () => {
      useEditorModeStore.getState().setMode('preview');
      useEditorModeStore.getState().setMode('reading');
      useEditorModeStore.getState().setMode('reading');

      const state = useEditorModeStore.getState();
      expect(state.mode).toBe('reading');
      expect(state.lastEditMode).toBe('preview');
    });
  });

  // ---------------------------------------------------------------------------
  // Cycle edit mode
  // ---------------------------------------------------------------------------

  describe('cycleEditMode', () => {
    it('should cycle from wysiwyg to source', () => {
      useEditorModeStore.getState().cycleEditMode();
      expect(useEditorModeStore.getState().mode).toBe('source');
    });

    it('should cycle from source to preview', () => {
      useEditorModeStore.getState().setMode('source');
      useEditorModeStore.getState().cycleEditMode();
      expect(useEditorModeStore.getState().mode).toBe('preview');
    });

    it('should cycle from preview back to wysiwyg', () => {
      useEditorModeStore.getState().setMode('preview');
      useEditorModeStore.getState().cycleEditMode();
      expect(useEditorModeStore.getState().mode).toBe('wysiwyg');
    });

    it('should exit reading mode to next edit mode from lastEditMode', () => {
      useEditorModeStore.getState().setMode('source');
      useEditorModeStore.getState().setMode('reading');
      useEditorModeStore.getState().cycleEditMode();

      // Was in reading with lastEditMode=source, cycles from source -> preview
      expect(useEditorModeStore.getState().mode).toBe('preview');
    });

    it('should update lastEditMode when cycling', () => {
      useEditorModeStore.getState().cycleEditMode(); // wysiwyg -> source
      expect(useEditorModeStore.getState().lastEditMode).toBe('source');

      useEditorModeStore.getState().cycleEditMode(); // source -> preview
      expect(useEditorModeStore.getState().lastEditMode).toBe('preview');
    });
  });

  // ---------------------------------------------------------------------------
  // Toggle reading mode
  // ---------------------------------------------------------------------------

  describe('toggleReadingMode', () => {
    it('should enter reading mode from wysiwyg', () => {
      useEditorModeStore.getState().toggleReadingMode();

      const state = useEditorModeStore.getState();
      expect(state.mode).toBe('reading');
      expect(state.lastEditMode).toBe('wysiwyg');
    });

    it('should exit reading mode back to last edit mode', () => {
      useEditorModeStore.getState().setMode('source');
      useEditorModeStore.getState().toggleReadingMode(); // enter reading
      useEditorModeStore.getState().toggleReadingMode(); // exit reading

      expect(useEditorModeStore.getState().mode).toBe('source');
    });

    it('should preserve last edit mode through multiple reading toggles', () => {
      useEditorModeStore.getState().setMode('preview');
      useEditorModeStore.getState().toggleReadingMode();
      expect(useEditorModeStore.getState().mode).toBe('reading');
      expect(useEditorModeStore.getState().lastEditMode).toBe('preview');

      useEditorModeStore.getState().toggleReadingMode();
      expect(useEditorModeStore.getState().mode).toBe('preview');
    });
  });

  // ---------------------------------------------------------------------------
  // Markdown content
  // ---------------------------------------------------------------------------

  describe('setMarkdown', () => {
    it('should update markdown content', () => {
      useEditorModeStore.getState().setMarkdown('# Hello World');
      expect(useEditorModeStore.getState().markdown).toBe('# Hello World');
    });

    it('should handle empty content', () => {
      useEditorModeStore.getState().setMarkdown('some content');
      useEditorModeStore.getState().setMarkdown('');
      expect(useEditorModeStore.getState().markdown).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Reading settings
  // ---------------------------------------------------------------------------

  describe('updateReadingSettings', () => {
    it('should update font size', () => {
      useEditorModeStore.getState().updateReadingSettings({ fontSize: 22 });
      expect(useEditorModeStore.getState().readingSettings.fontSize).toBe(22);
    });

    it('should clamp font size to minimum of 14', () => {
      useEditorModeStore.getState().updateReadingSettings({ fontSize: 8 });
      expect(useEditorModeStore.getState().readingSettings.fontSize).toBe(14);
    });

    it('should clamp font size to maximum of 28', () => {
      useEditorModeStore.getState().updateReadingSettings({ fontSize: 40 });
      expect(useEditorModeStore.getState().readingSettings.fontSize).toBe(28);
    });

    it('should update line height', () => {
      useEditorModeStore.getState().updateReadingSettings({ lineHeight: 2.0 });
      expect(useEditorModeStore.getState().readingSettings.lineHeight).toBe(2.0);
    });

    it('should clamp line height within range', () => {
      useEditorModeStore.getState().updateReadingSettings({ lineHeight: 0.5 });
      expect(useEditorModeStore.getState().readingSettings.lineHeight).toBe(1.4);

      useEditorModeStore.getState().updateReadingSettings({ lineHeight: 5.0 });
      expect(useEditorModeStore.getState().readingSettings.lineHeight).toBe(2.4);
    });

    it('should update content width', () => {
      useEditorModeStore.getState().updateReadingSettings({ contentWidth: 80 });
      expect(useEditorModeStore.getState().readingSettings.contentWidth).toBe(80);
    });

    it('should clamp content width within range', () => {
      useEditorModeStore.getState().updateReadingSettings({ contentWidth: 20 });
      expect(useEditorModeStore.getState().readingSettings.contentWidth).toBe(40);

      useEditorModeStore.getState().updateReadingSettings({ contentWidth: 150 });
      expect(useEditorModeStore.getState().readingSettings.contentWidth).toBe(100);
    });

    it('should update font family', () => {
      useEditorModeStore.getState().updateReadingSettings({ fontFamily: 'sans' });
      expect(useEditorModeStore.getState().readingSettings.fontFamily).toBe('sans');
    });

    it('should partially update without affecting other settings', () => {
      useEditorModeStore.getState().updateReadingSettings({ fontSize: 20 });
      const settings = useEditorModeStore.getState().readingSettings;
      expect(settings.fontSize).toBe(20);
      expect(settings.lineHeight).toBe(1.8); // unchanged default
      expect(settings.fontFamily).toBe('serif'); // unchanged default
    });
  });

  describe('resetReadingSettings', () => {
    it('should reset to defaults', () => {
      useEditorModeStore.getState().updateReadingSettings({
        fontSize: 24,
        lineHeight: 2.2,
        contentWidth: 90,
        fontFamily: 'mono',
      });

      useEditorModeStore.getState().resetReadingSettings();

      const settings = useEditorModeStore.getState().readingSettings;
      expect(settings.fontSize).toBe(18);
      expect(settings.lineHeight).toBe(1.8);
      expect(settings.contentWidth).toBe(65);
      expect(settings.fontFamily).toBe('serif');
    });
  });
});
