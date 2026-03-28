/**
 * search-replace feature — workspace-level search & replace across all notes.
 *
 * Public API:
 *   - SearchReplaceModal: Modal component (mount once, toggles via Cmd+Shift+H)
 *   - SearchReplacePanel: Standalone panel (for sidebar embedding)
 *   - useSearchReplace: Hook for programmatic control
 *   - useSearchReplaceStore: Zustand store for direct access
 */

export { SearchReplaceModal } from './ui/SearchReplaceModal';
export { SearchReplacePanel } from './ui/SearchReplacePanel';
export { useSearchReplace } from './hooks/useSearchReplace';
export { useSearchReplaceStore } from './model/search-replace-store';
export type { SearchReplaceMatch, NoteMatchGroup } from './model/search-replace-store';
