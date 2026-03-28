/**
 * NavigationButtons.tsx
 *
 * Back/Forward navigation buttons for per-tab history.
 *
 * Renders two icon buttons that navigate through a tab's history stack.
 * Buttons are disabled when no back/forward history is available.
 *
 * Keyboard shortcuts (Alt+Left / Alt+Right) are registered globally in
 * KeyboardShortcutsProvider — these buttons are for mouse/touch interaction.
 *
 * Design notes:
 *   - No useEffect needed: button disabled state is derived from store state
 *     during render (canGoBack / canGoForward are synchronous reads).
 *   - Navigation action is handled in the click event handler, not in an effect.
 */

'use client';

import { useNavigationHistoryStore } from './navigation-history-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useLayoutStore } from '@/shared/stores/layout-store';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M10.354 3.354a.5.5 0 010 .707L6.707 8l3.647 3.646a.5.5 0 01-.708.708l-4-4a.5.5 0 010-.708l4-4a.5.5 0 01.708 0z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M5.646 3.354a.5.5 0 01.708 0l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L9.293 8 5.646 4.354a.5.5 0 010-.707z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NavigationButtonsProps {
  /** The ID of the tab these navigation buttons control. */
  tabId?: string;
}

/**
 * Back/Forward navigation buttons for per-tab history.
 *
 * When no tabId is provided, derives the active tab from the current note
 * and first panel — matching the most common single-tab scenario.
 */
export function NavigationButtons({ tabId: tabIdProp }: NavigationButtonsProps) {
  const activeNoteId = useWorkspaceStore((s) => s.activeNoteId);
  const tabs = useLayoutStore((s) => s.currentLayout.tabs);
  const setActiveNote = useWorkspaceStore((s) => s.setActiveNote);

  // Determine the active tab ID — either from props or from the first tab
  // matching the active note.
  const derivedTabId =
    tabIdProp ?? tabs.find((t) => t.noteId === activeNoteId)?.id ?? tabs[0]?.id ?? 'default';

  const canGoBack = useNavigationHistoryStore((s) => s.canGoBack(derivedTabId));
  const canGoForward = useNavigationHistoryStore((s) => s.canGoForward(derivedTabId));
  const goBack = useNavigationHistoryStore((s) => s.goBack);
  const goForward = useNavigationHistoryStore((s) => s.goForward);

  function handleGoBack() {
    const noteId = goBack(derivedTabId);
    if (noteId !== null) {
      setActiveNote(noteId);
    }
  }

  function handleGoForward() {
    const noteId = goForward(derivedTabId);
    if (noteId !== null) {
      setActiveNote(noteId);
    }
  }

  return (
    <div className="flex items-center gap-0.5" role="navigation" aria-label="Tab history">
      <button
        onClick={handleGoBack}
        disabled={!canGoBack}
        aria-label="Navigate back (Alt+Left)"
        title="Back (Alt+Left)"
        className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground-muted"
      >
        <ChevronLeftIcon />
      </button>
      <button
        onClick={handleGoForward}
        disabled={!canGoForward}
        aria-label="Navigate forward (Alt+Right)"
        title="Forward (Alt+Right)"
        className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground-muted"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
