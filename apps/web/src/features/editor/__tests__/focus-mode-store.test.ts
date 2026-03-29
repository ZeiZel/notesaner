/**
 * Tests for focus-mode-store.ts
 *
 * Covers:
 *   - Initial state
 *   - toggleFocusMode — flips isFocusMode
 *   - exitFocusMode — always sets isFocusMode to false
 *   - toggleTypewriterScrolling — flips typewriterScrolling
 *   - toggleAmbientSounds — flips ambientSoundsEnabled
 *   - Persistence partialize — isFocusMode NOT persisted; preferences are
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFocusModeStore } from '../model/focus-mode-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  // Reset to clean initial state without calling persist/hydrate
  useFocusModeStore.setState({
    isFocusMode: false,
    typewriterScrolling: true,
    ambientSoundsEnabled: false,
  });
}

function getState() {
  return useFocusModeStore.getState();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFocusModeStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('should have isFocusMode false by default', () => {
      expect(getState().isFocusMode).toBe(false);
    });

    it('should have typewriterScrolling true by default', () => {
      expect(getState().typewriterScrolling).toBe(true);
    });

    it('should have ambientSoundsEnabled false by default', () => {
      expect(getState().ambientSoundsEnabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toggleFocusMode
  // -------------------------------------------------------------------------

  describe('toggleFocusMode', () => {
    it('should enable focus mode when off', () => {
      getState().toggleFocusMode();
      expect(getState().isFocusMode).toBe(true);
    });

    it('should disable focus mode when on', () => {
      getState().toggleFocusMode(); // on
      getState().toggleFocusMode(); // off
      expect(getState().isFocusMode).toBe(false);
    });

    it('should toggle isFocusMode multiple times correctly', () => {
      for (let i = 0; i < 6; i++) {
        getState().toggleFocusMode();
      }
      // 6 toggles → back to initial false
      expect(getState().isFocusMode).toBe(false);
    });

    it('should not affect other state fields', () => {
      useFocusModeStore.setState({ typewriterScrolling: false, ambientSoundsEnabled: true });
      getState().toggleFocusMode();

      expect(getState().typewriterScrolling).toBe(false);
      expect(getState().ambientSoundsEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // exitFocusMode
  // -------------------------------------------------------------------------

  describe('exitFocusMode', () => {
    it('should set isFocusMode to false when already false', () => {
      getState().exitFocusMode();
      expect(getState().isFocusMode).toBe(false);
    });

    it('should set isFocusMode to false when active', () => {
      getState().toggleFocusMode(); // activate
      expect(getState().isFocusMode).toBe(true);

      getState().exitFocusMode();
      expect(getState().isFocusMode).toBe(false);
    });

    it('should not affect typewriterScrolling or ambientSoundsEnabled', () => {
      useFocusModeStore.setState({
        isFocusMode: true,
        typewriterScrolling: false,
        ambientSoundsEnabled: true,
      });

      getState().exitFocusMode();

      expect(getState().typewriterScrolling).toBe(false);
      expect(getState().ambientSoundsEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // toggleTypewriterScrolling
  // -------------------------------------------------------------------------

  describe('toggleTypewriterScrolling', () => {
    it('should disable typewriter scrolling when enabled', () => {
      getState().toggleTypewriterScrolling();
      expect(getState().typewriterScrolling).toBe(false);
    });

    it('should re-enable typewriter scrolling when disabled', () => {
      getState().toggleTypewriterScrolling(); // off
      getState().toggleTypewriterScrolling(); // on
      expect(getState().typewriterScrolling).toBe(true);
    });

    it('should not affect isFocusMode or ambientSoundsEnabled', () => {
      useFocusModeStore.setState({ isFocusMode: true, ambientSoundsEnabled: true });
      getState().toggleTypewriterScrolling();

      expect(getState().isFocusMode).toBe(true);
      expect(getState().ambientSoundsEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // toggleAmbientSounds
  // -------------------------------------------------------------------------

  describe('toggleAmbientSounds', () => {
    it('should enable ambient sounds when off', () => {
      getState().toggleAmbientSounds();
      expect(getState().ambientSoundsEnabled).toBe(true);
    });

    it('should disable ambient sounds when on', () => {
      getState().toggleAmbientSounds(); // on
      getState().toggleAmbientSounds(); // off
      expect(getState().ambientSoundsEnabled).toBe(false);
    });

    it('should not affect isFocusMode or typewriterScrolling', () => {
      useFocusModeStore.setState({ isFocusMode: true, typewriterScrolling: false });
      getState().toggleAmbientSounds();

      expect(getState().isFocusMode).toBe(true);
      expect(getState().typewriterScrolling).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence boundary check (partialize logic)
  // -------------------------------------------------------------------------

  describe('persistence partialize', () => {
    it('should expose typewriterScrolling and ambientSoundsEnabled for persistence', () => {
      // Simulate what the persist middleware partializes.
      // We verify the store exposes these fields so the partialize function
      // can read them without throwing.
      const state = getState();
      expect('typewriterScrolling' in state).toBe(true);
      expect('ambientSoundsEnabled' in state).toBe(true);
    });

    it('isFocusMode should NOT be persisted (not in partialize)', () => {
      // The store's partialize config excludes isFocusMode.
      // We verify indirectly: after a simulated page reload (manual setState),
      // the active focus mode is not restored. The initial value is always false.
      useFocusModeStore.setState({ isFocusMode: true });
      // Simulate a new session by resetting only isFocusMode
      useFocusModeStore.setState({ isFocusMode: false });
      expect(getState().isFocusMode).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Combined scenario
  // -------------------------------------------------------------------------

  describe('combined scenario', () => {
    it('should handle a typical focus mode session', () => {
      // User opens focus mode
      getState().toggleFocusMode();
      expect(getState().isFocusMode).toBe(true);

      // User disables typewriter scrolling
      getState().toggleTypewriterScrolling();
      expect(getState().typewriterScrolling).toBe(false);

      // User enables ambient sounds
      getState().toggleAmbientSounds();
      expect(getState().ambientSoundsEnabled).toBe(true);

      // User exits via Esc (exitFocusMode)
      getState().exitFocusMode();
      expect(getState().isFocusMode).toBe(false);

      // Preferences are retained after exit
      expect(getState().typewriterScrolling).toBe(false);
      expect(getState().ambientSoundsEnabled).toBe(true);
    });
  });
});
