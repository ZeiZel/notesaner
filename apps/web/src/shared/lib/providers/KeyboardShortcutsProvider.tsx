'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { CommandPaletteDialog } from '@/features/workspace/CommandPaletteDialog';

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

/**
 * Workspace-level keyboard shortcut provider.
 *
 * Registers all global shortcuts defined in keyboard-shortcuts.ts and owns the
 * UI state for dialogs that shortcuts trigger (command palette, quick switcher,
 * global search).
 *
 * Mount this once inside the workspace layout, below all context providers
 * it depends on (auth, sidebar, workspace stores).
 *
 * The command palette opens via Cmd/Ctrl+P and gives access to all workspace
 * commands, with fuzzy search, category grouping, and recent commands.
 *
 * Editor-internal shortcuts (Bold, Italic, Headings, Undo/Redo, etc.) are
 * handled by TipTap extensions and do NOT go through this provider.
 */
export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();

  // Sidebar actions from the persisted store
  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useSidebarStore((s) => s.toggleRightSidebar);

  // Workspace context for note-creation navigation
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Dialog open/close state — one source of truth, co-located with the provider
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Disable global shortcuts while any dialog is open so the dialogs can
  // handle Arrow keys, Escape, etc. independently.
  const isAnyDialogOpen = isCommandPaletteOpen;

  useKeyboardShortcuts(
    {
      'new-note': () => {
        if (activeWorkspaceId !== null) {
          // Navigate to workspace root; the workspace page will create a new note.
          router.push(`/workspaces/${activeWorkspaceId}`);
        }
      },

      'quick-switcher': () => {
        // TODO(sprint-2): open quick switcher dialog
      },

      'command-palette': () => {
        setIsCommandPaletteOpen((prev) => !prev);
      },

      // Cmd+S: notes auto-save via NoteEditor's debounced handler. The shortcut
      // is still registered so we can call preventDefault() and suppress the
      // browser's native "Save page as…" dialog.
      'save-note': () => {
        // Intentional no-op: auto-save handles persistence.
      },

      'global-search': () => {
        // TODO(sprint-2): open global search dialog
      },

      'toggle-left-sidebar': () => {
        toggleLeftSidebar();
      },

      'toggle-right-sidebar': () => {
        toggleRightSidebar();
      },

      // Cmd+F / Cmd+H: prevent the browser's native find UI from opening.
      // TipTap find-in-note will be implemented as an editor extension in sprint-2.
      'find-in-note': () => {
        // TODO(sprint-2): open TipTap find panel when editor is focused
      },

      'find-replace': () => {
        // TODO(sprint-2): open TipTap find-replace panel when editor is focused
      },

      // Cmd+E: toggle source / reading view.
      'toggle-source-preview': () => {
        // TODO(sprint-2): dispatch view mode toggle action
      },

      // Cmd+Shift+W: workspace switcher
      'workspace-switcher': () => {
        // TODO(sprint-2): open workspace switcher dialog
      },
    },
    !isAnyDialogOpen,
  );

  return (
    <>
      {children}

      {/* Command palette — Cmd+P */}
      <CommandPaletteDialog
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  );
}
