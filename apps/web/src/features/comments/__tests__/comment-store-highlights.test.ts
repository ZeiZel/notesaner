/**
 * Tests for comment store highlight visibility toggle.
 *
 * Validates the new `highlightsVisible` state field and its associated actions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCommentStore } from '@/shared/stores/comment-store';

describe('comment-store highlight visibility', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCommentStore.getState().reset();
  });

  it('should default highlightsVisible to true', () => {
    expect(useCommentStore.getState().highlightsVisible).toBe(true);
  });

  it('should toggle highlightsVisible', () => {
    const { toggleHighlights } = useCommentStore.getState();

    toggleHighlights();
    expect(useCommentStore.getState().highlightsVisible).toBe(false);

    toggleHighlights();
    expect(useCommentStore.getState().highlightsVisible).toBe(true);
  });

  it('should set highlightsVisible explicitly', () => {
    const { setHighlightsVisible } = useCommentStore.getState();

    setHighlightsVisible(false);
    expect(useCommentStore.getState().highlightsVisible).toBe(false);

    setHighlightsVisible(true);
    expect(useCommentStore.getState().highlightsVisible).toBe(true);
  });

  it('should reset highlightsVisible to true on reset()', () => {
    const { setHighlightsVisible, reset } = useCommentStore.getState();

    setHighlightsVisible(false);
    expect(useCommentStore.getState().highlightsVisible).toBe(false);

    reset();
    expect(useCommentStore.getState().highlightsVisible).toBe(true);
  });
});
