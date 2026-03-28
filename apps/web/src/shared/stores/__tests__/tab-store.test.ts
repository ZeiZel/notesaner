/**
 * Tests for tab-store.ts
 *
 * Covers:
 *   - openTab — new tab, duplicate prevention, activation
 *   - closeTab — removal, adjacent activation, no-op for missing ID
 *   - closeOthers — preserves pinned and target tab
 *   - closeToTheRight — preserves pinned tabs after target
 *   - closeSaved — removes clean unpinned tabs, preserves dirty + pinned
 *   - closeAll — clears all, force clears pinned
 *   - setActiveTab — activation, no-op for missing ID
 *   - reorderTabs — index swap, boundary checks
 *   - setTabDirty — dirty state toggle
 *   - togglePinTab — pin/unpin toggle
 *   - updateTabTitle — title update
 *   - cycleTab — forward/backward cycling with wrap-around
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '../tab-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useTabStore.setState({
    tabs: [],
    activeTabId: null,
  });
}

function openTestTab(noteId: string, title: string = noteId) {
  useTabStore.getState().openTab({
    noteId,
    title,
    path: `/${title}.md`,
  });
}

function getState() {
  return useTabStore.getState();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TabStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // -------------------------------------------------------------------------
  // openTab
  // -------------------------------------------------------------------------

  describe('openTab', () => {
    it('adds a new tab and activates it', () => {
      openTestTab('note-1', 'Note 1');

      const { tabs, activeTabId } = getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0]?.noteId).toBe('note-1');
      expect(tabs[0]?.title).toBe('Note 1');
      expect(tabs[0]?.isDirty).toBe(false);
      expect(tabs[0]?.isPinned).toBe(false);
      expect(activeTabId).toBe(tabs[0]?.id);
    });

    it('does not duplicate tabs for the same noteId', () => {
      openTestTab('note-1');
      const firstId = getState().tabs[0]?.id;

      openTestTab('note-1');
      const { tabs, activeTabId } = getState();

      expect(tabs).toHaveLength(1);
      expect(activeTabId).toBe(firstId);
    });

    it('activates existing tab when opening duplicate noteId', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      expect(getState().activeTabId).toBe(getState().tabs[1]?.id);

      openTestTab('note-1');
      expect(getState().activeTabId).toBe(getState().tabs[0]?.id);
    });
  });

  // -------------------------------------------------------------------------
  // closeTab
  // -------------------------------------------------------------------------

  describe('closeTab', () => {
    it('removes the tab', () => {
      openTestTab('note-1');
      const tabId = getState().tabs[0]?.id ?? '';

      getState().closeTab(tabId);
      expect(getState().tabs).toHaveLength(0);
      expect(getState().activeTabId).toBeNull();
    });

    it('activates the next tab when closing the active tab', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      // Activate middle tab
      const middleId = getState().tabs[1]?.id ?? '';
      getState().setActiveTab(middleId);

      getState().closeTab(middleId);
      const { tabs, activeTabId } = getState();

      expect(tabs).toHaveLength(2);
      // Should activate the tab at the same index (note-3 moved to index 1)
      expect(activeTabId).toBe(tabs[1]?.id);
    });

    it('activates previous tab when closing last tab in list', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const lastId = getState().tabs[1]?.id ?? '';
      getState().setActiveTab(lastId);
      getState().closeTab(lastId);

      expect(getState().activeTabId).toBe(getState().tabs[0]?.id);
    });

    it('is a no-op for non-existent tab ID', () => {
      openTestTab('note-1');
      const before = getState();

      getState().closeTab('non-existent');
      expect(getState().tabs).toEqual(before.tabs);
    });
  });

  // -------------------------------------------------------------------------
  // closeOthers
  // -------------------------------------------------------------------------

  describe('closeOthers', () => {
    it('closes all tabs except the target', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      const keepId = getState().tabs[1]?.id ?? '';
      getState().closeOthers(keepId);

      expect(getState().tabs).toHaveLength(1);
      expect(getState().tabs[0]?.id).toBe(keepId);
      expect(getState().activeTabId).toBe(keepId);
    });

    it('preserves pinned tabs', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      const pinnedId = getState().tabs[0]?.id ?? '';
      getState().togglePinTab(pinnedId);

      const keepId = getState().tabs[2]?.id ?? '';
      getState().closeOthers(keepId);

      expect(getState().tabs).toHaveLength(2);
      expect(getState().tabs.find((t) => t.id === pinnedId)).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // closeToTheRight
  // -------------------------------------------------------------------------

  describe('closeToTheRight', () => {
    it('closes all tabs to the right of the target', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');
      openTestTab('note-4');

      const targetId = getState().tabs[1]?.id ?? '';
      getState().closeToTheRight(targetId);

      expect(getState().tabs).toHaveLength(2);
      expect(getState().tabs[0]?.noteId).toBe('note-1');
      expect(getState().tabs[1]?.noteId).toBe('note-2');
    });

    it('preserves pinned tabs to the right', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      const pinnedId = getState().tabs[2]?.id ?? '';
      getState().togglePinTab(pinnedId);

      const targetId = getState().tabs[0]?.id ?? '';
      getState().closeToTheRight(targetId);

      expect(getState().tabs).toHaveLength(2);
      expect(getState().tabs.find((t) => t.id === pinnedId)).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // closeSaved
  // -------------------------------------------------------------------------

  describe('closeSaved', () => {
    it('closes all clean, unpinned tabs', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      // Make note-2 dirty
      const dirtyId = getState().tabs[1]?.id ?? '';
      getState().setTabDirty(dirtyId, true);

      getState().closeSaved();

      expect(getState().tabs).toHaveLength(1);
      expect(getState().tabs[0]?.noteId).toBe('note-2');
    });

    it('preserves pinned tabs even if clean', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const pinnedId = getState().tabs[0]?.id ?? '';
      getState().togglePinTab(pinnedId);

      getState().closeSaved();

      expect(getState().tabs).toHaveLength(1);
      expect(getState().tabs[0]?.id).toBe(pinnedId);
    });

    it('updates activeTabId when active tab is closed', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      // note-3 is active, note-2 is dirty
      const dirtyId = getState().tabs[1]?.id ?? '';
      getState().setTabDirty(dirtyId, true);

      getState().closeSaved();

      // Only dirty tab remains, should be active
      expect(getState().activeTabId).toBe(dirtyId);
    });
  });

  // -------------------------------------------------------------------------
  // closeAll
  // -------------------------------------------------------------------------

  describe('closeAll', () => {
    it('preserves pinned tabs without force', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const pinnedId = getState().tabs[0]?.id ?? '';
      getState().togglePinTab(pinnedId);

      getState().closeAll();

      expect(getState().tabs).toHaveLength(1);
      expect(getState().tabs[0]?.id).toBe(pinnedId);
    });

    it('closes all tabs including pinned with force=true', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      getState().togglePinTab(getState().tabs[0]?.id ?? '');

      getState().closeAll(true);

      expect(getState().tabs).toHaveLength(0);
      expect(getState().activeTabId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // reorderTabs
  // -------------------------------------------------------------------------

  describe('reorderTabs', () => {
    it('moves a tab from one position to another', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      getState().reorderTabs(0, 2);

      const { tabs } = getState();
      expect(tabs[0]?.noteId).toBe('note-2');
      expect(tabs[1]?.noteId).toBe('note-3');
      expect(tabs[2]?.noteId).toBe('note-1');
    });

    it('is a no-op for invalid indices', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const before = getState().tabs.map((t) => t.noteId);

      getState().reorderTabs(-1, 0);
      getState().reorderTabs(0, 5);
      getState().reorderTabs(1, 1);

      expect(getState().tabs.map((t) => t.noteId)).toEqual(before);
    });
  });

  // -------------------------------------------------------------------------
  // setTabDirty
  // -------------------------------------------------------------------------

  describe('setTabDirty', () => {
    it('marks a tab as dirty', () => {
      openTestTab('note-1');
      const tabId = getState().tabs[0]?.id ?? '';

      getState().setTabDirty(tabId, true);
      expect(getState().tabs[0]?.isDirty).toBe(true);

      getState().setTabDirty(tabId, false);
      expect(getState().tabs[0]?.isDirty).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // togglePinTab
  // -------------------------------------------------------------------------

  describe('togglePinTab', () => {
    it('pins and unpins a tab', () => {
      openTestTab('note-1');
      const tabId = getState().tabs[0]?.id ?? '';

      getState().togglePinTab(tabId);
      expect(getState().tabs[0]?.isPinned).toBe(true);

      getState().togglePinTab(tabId);
      expect(getState().tabs[0]?.isPinned).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // updateTabTitle
  // -------------------------------------------------------------------------

  describe('updateTabTitle', () => {
    it('updates the title of a tab', () => {
      openTestTab('note-1', 'Original Title');
      const tabId = getState().tabs[0]?.id ?? '';

      getState().updateTabTitle(tabId, 'New Title');
      expect(getState().tabs[0]?.title).toBe('New Title');
    });
  });

  // -------------------------------------------------------------------------
  // cycleTab
  // -------------------------------------------------------------------------

  describe('cycleTab', () => {
    it('cycles forward through tabs', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      // Active is note-3 (last opened)
      const ids = getState().tabs.map((t) => t.id);

      getState().setActiveTab(ids[0] ?? '');
      getState().cycleTab(1);
      expect(getState().activeTabId).toBe(ids[1]);

      getState().cycleTab(1);
      expect(getState().activeTabId).toBe(ids[2]);
    });

    it('wraps around forward', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const ids = getState().tabs.map((t) => t.id);

      getState().setActiveTab(ids[1] ?? '');
      getState().cycleTab(1);
      expect(getState().activeTabId).toBe(ids[0]);
    });

    it('cycles backward through tabs', () => {
      openTestTab('note-1');
      openTestTab('note-2');
      openTestTab('note-3');

      const ids = getState().tabs.map((t) => t.id);

      getState().setActiveTab(ids[2] ?? '');
      getState().cycleTab(-1);
      expect(getState().activeTabId).toBe(ids[1]);
    });

    it('wraps around backward', () => {
      openTestTab('note-1');
      openTestTab('note-2');

      const ids = getState().tabs.map((t) => t.id);

      getState().setActiveTab(ids[0] ?? '');
      getState().cycleTab(-1);
      expect(getState().activeTabId).toBe(ids[1]);
    });

    it('is a no-op when no tabs exist', () => {
      getState().cycleTab(1);
      expect(getState().activeTabId).toBeNull();
    });
  });
});
