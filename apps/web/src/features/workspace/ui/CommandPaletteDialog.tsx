'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette, type CommandPaletteAction } from '@notesaner/ui';
import { KEYBOARD_SHORTCUTS, formatCombo, type ShortcutId } from '@/shared/lib/keyboard-shortcuts';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useTheme } from '@/shared/lib/providers/ThemeProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_COMMANDS_KEY = 'notesaner-recent-commands';
const MAX_RECENT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandDefinition {
  id: string;
  label: string;
  description?: string;
  group: CommandGroup;
  shortcutId?: ShortcutId;
  keywords?: string[];
  icon?: React.ReactNode;
  action: () => void;
}

type CommandGroup = 'Recent' | 'File Operations' | 'Navigation' | 'View' | 'Editor' | 'Settings';

// ---------------------------------------------------------------------------
// Icons (inline SVGs to avoid extra dependencies)
// ---------------------------------------------------------------------------

function IconFile() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconSidebar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconFind() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <line x1="8" y1="11" x2="14" y2="11" />
      <line x1="11" y1="8" x2="11" y2="14" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Recent commands helpers
// ---------------------------------------------------------------------------

function loadRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentCommandId(commandId: string): void {
  try {
    const existing = loadRecentCommandIds();
    const next = [commandId, ...existing.filter((id) => id !== commandId)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private browsing, etc.) — silent fail
  }
}

// ---------------------------------------------------------------------------
// Shortcut label helpers
// ---------------------------------------------------------------------------

const shortcutComboMap = Object.fromEntries(
  KEYBOARD_SHORTCUTS.map((s) => [s.id, formatCombo(s.combo)]),
) as Record<string, string>;

function shortcutLabel(id: ShortcutId): string[] {
  const formatted = shortcutComboMap[id];
  if (!formatted) return [];
  // Each string in the array is rendered as its own <kbd> element by
  // the CommandPalette component.
  return [formatted];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommandPaletteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user triggers "Global search" from within the palette. */
  onOpenSearch?: () => void;
  /** Called when the user triggers "Quick switcher" from within the palette. */
  onOpenQuickSwitcher?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full command palette dialog (Cmd+P).
 *
 * Renders all workspace commands grouped by category. Supports:
 *  - Fuzzy search/filter via cmdk
 *  - Keyboard shortcut hints rendered next to each command
 *  - Recently used commands at the top (persisted in localStorage)
 *  - Execute on Enter or click; closes the dialog automatically
 *  - WCAG: uses aria-activedescendant pattern via cmdk Command component
 *
 * Design philosophy:
 *  - useEffect here is valid: loading recent commands is a one-time
 *    side effect on open (reading from localStorage, an external store).
 *  - Command definitions are derived in useMemo — no effect needed.
 */
export function CommandPaletteDialog({
  open,
  onClose,
  onOpenSearch,
  onOpenQuickSwitcher,
}: CommandPaletteDialogProps) {
  const router = useRouter();
  const { preference, resolvedTheme, setPreference } = useTheme();

  const toggleLeftSidebar = useSidebarStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useSidebarStore((s) => s.toggleRightSidebar);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Recent command IDs — loaded once when the dialog opens.
  // useEffect is valid here: reading from localStorage (external store) on open.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const didLoad = useRef(false);

  useEffect(() => {
    if (open && !didLoad.current) {
      setRecentIds(loadRecentCommandIds());
      didLoad.current = true;
    }
    if (!open) {
      didLoad.current = false;
    }
  }, [open]);

  // Stable wrapper so the action callbacks don't need to be re-declared
  const trackAndClose = useCallback(
    (commandId: string, action: () => void) => {
      saveRecentCommandId(commandId);
      setRecentIds(loadRecentCommandIds());
      action();
      onClose();
    },
    [onClose],
  );

  // Derive the current theme for the toggle label.
  // preference and resolvedTheme come from the ThemeProvider context.
  const isDark =
    preference === 'system'
      ? resolvedTheme === 'dark'
      : preference === 'dark' || preference === 'ayu-dark' || preference === 'nord';

  // ---------------------------------------------------------------------------
  // Command definitions
  // ---------------------------------------------------------------------------

  const allCommands = useMemo<CommandDefinition[]>(
    () => [
      // --- File Operations ---
      {
        id: 'cmd-new-note',
        label: 'New note',
        description: 'Create a new note in the current workspace',
        group: 'File Operations',
        shortcutId: 'new-note',
        keywords: ['create', 'add', 'file', 'document'],
        icon: <IconFile />,
        action: () => {
          if (activeWorkspaceId !== null) {
            router.push(`/workspaces/${activeWorkspaceId}`);
          }
        },
      },
      {
        id: 'cmd-save-note',
        label: 'Save note',
        description: 'Notes are auto-saved — this confirms the current save',
        group: 'File Operations',
        shortcutId: 'save-note',
        keywords: ['save', 'persist', 'write'],
        icon: <IconFile />,
        action: () => {
          // Auto-save is active; this is a no-op but provides user feedback
        },
      },

      // --- Navigation ---
      {
        id: 'cmd-global-search',
        label: 'Search in all notes',
        description: 'Full-text search across your entire workspace',
        group: 'Navigation',
        shortcutId: 'global-search',
        keywords: ['find', 'search', 'fts', 'full text'],
        icon: <IconSearch />,
        action: () => {
          onOpenSearch?.();
        },
      },
      {
        id: 'cmd-quick-switcher',
        label: 'Quick switcher',
        description: 'Jump to a recently opened note by title',
        group: 'Navigation',
        shortcutId: 'quick-switcher',
        keywords: ['open', 'switch', 'jump', 'go to', 'recent'],
        icon: <IconSearch />,
        action: () => {
          onOpenQuickSwitcher?.();
        },
      },
      {
        id: 'cmd-open-settings',
        label: 'Open settings',
        description: 'Navigate to workspace settings',
        group: 'Navigation',
        keywords: ['preferences', 'config', 'options'],
        icon: <IconSettings />,
        action: () => {
          if (activeWorkspaceId !== null) {
            router.push(`/workspaces/${activeWorkspaceId}/settings`);
          }
        },
      },
      {
        id: 'cmd-open-graph',
        label: 'Open graph view',
        description: 'Visualize note connections as a knowledge graph',
        group: 'Navigation',
        keywords: ['graph', 'network', 'links', 'connections', 'zettelkasten'],
        icon: <IconSearch />,
        action: () => {
          if (activeWorkspaceId !== null) {
            router.push(`/workspaces/${activeWorkspaceId}/graph`);
          }
        },
      },

      // --- View ---
      {
        id: 'cmd-toggle-left-sidebar',
        label: 'Toggle left sidebar',
        description: 'Show or hide the file explorer panel',
        group: 'View',
        shortcutId: 'toggle-left-sidebar',
        keywords: ['sidebar', 'panel', 'explorer', 'left', 'hide', 'show'],
        icon: <IconSidebar />,
        action: () => {
          toggleLeftSidebar();
        },
      },
      {
        id: 'cmd-toggle-right-sidebar',
        label: 'Toggle right sidebar',
        description: 'Show or hide the outline, backlinks, and properties panel',
        group: 'View',
        shortcutId: 'toggle-right-sidebar',
        keywords: ['sidebar', 'panel', 'right', 'outline', 'backlinks', 'hide', 'show'],
        icon: <IconSidebar />,
        action: () => {
          toggleRightSidebar();
        },
      },
      {
        id: 'cmd-toggle-theme',
        label: isDark ? 'Switch to light theme' : 'Switch to dark theme',
        description: 'Toggle between Catppuccin Mocha (dark) and Latte (light)',
        group: 'View',
        shortcutId: 'toggle-theme',
        keywords: ['theme', 'dark', 'light', 'mode', 'appearance', 'color'],
        icon: isDark ? <IconSun /> : <IconMoon />,
        action: () => {
          setPreference(isDark ? 'light' : 'dark');
        },
      },

      // --- Editor ---
      {
        id: 'cmd-toggle-source-preview',
        label: 'Toggle source / reading view',
        description: 'Switch between editing and preview mode',
        group: 'Editor',
        shortcutId: 'toggle-source-preview',
        keywords: ['preview', 'source', 'read', 'edit', 'view', 'mode'],
        icon: <IconEye />,
        action: () => {
          // TODO(sprint-2): dispatch view mode toggle action
        },
      },
      {
        id: 'cmd-find-in-note',
        label: 'Find in note',
        description: 'Search within the currently open note',
        group: 'Editor',
        shortcutId: 'find-in-note',
        keywords: ['find', 'search', 'text', 'in-note'],
        icon: <IconFind />,
        action: () => {
          // TODO(sprint-2): open TipTap find panel
        },
      },
      {
        id: 'cmd-find-replace',
        label: 'Find & replace in note',
        description: 'Find and replace text within the current note',
        group: 'Editor',
        shortcutId: 'find-replace',
        keywords: ['find', 'replace', 'substitute', 'text'],
        icon: <IconFind />,
        action: () => {
          // TODO(sprint-2): open TipTap find-replace panel
        },
      },

      // --- Settings ---
      {
        id: 'cmd-open-workspace-settings',
        label: 'Workspace settings',
        description: 'Manage workspace name, members, and access',
        group: 'Settings',
        keywords: ['workspace', 'settings', 'members', 'permissions', 'admin'],
        icon: <IconSettings />,
        action: () => {
          if (activeWorkspaceId !== null) {
            router.push(`/workspaces/${activeWorkspaceId}/settings/general`);
          }
        },
      },
      {
        id: 'cmd-open-plugins',
        label: 'Manage plugins',
        description: 'Install, enable, or disable workspace plugins',
        group: 'Settings',
        keywords: ['plugins', 'extensions', 'add-ons', 'marketplace'],
        icon: <IconSettings />,
        action: () => {
          if (activeWorkspaceId !== null) {
            router.push(`/workspaces/${activeWorkspaceId}/plugins`);
          }
        },
      },
    ],
    [activeWorkspaceId, isDark, onOpenSearch, onOpenQuickSwitcher],
  );

  // ---------------------------------------------------------------------------
  // Build the actions list passed to CommandPalette
  // ---------------------------------------------------------------------------

  const actions = useMemo<CommandPaletteAction[]>(() => {
    const recentSet = new Set(recentIds);
    const commandById = new Map(allCommands.map((c) => [c.id, c]));

    // Recent group — commands the user ran recently (preserve recent order)
    const recentActions: CommandPaletteAction[] = recentIds
      .map((id) => commandById.get(id))
      .filter((c): c is CommandDefinition => c !== undefined)
      .map((c) => toAction(c, 'Recent', trackAndClose));

    // All other commands (grouped, deduplicated from recent)
    const nonRecentActions: CommandPaletteAction[] = allCommands
      .filter((c) => !recentSet.has(c.id))
      .map((c) => toAction(c, c.group, trackAndClose));

    return [...recentActions, ...nonRecentActions];
  }, [allCommands, recentIds, trackAndClose]);

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      actions={actions}
      placeholder="Type a command or search..."
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAction(
  command: CommandDefinition,
  group: CommandGroup,
  trackAndClose: (id: string, action: () => void) => void,
): CommandPaletteAction {
  return {
    id: group === 'Recent' ? `recent-${command.id}` : command.id,
    label: command.label,
    description: command.description,
    group,
    keywords: command.keywords,
    icon: group === 'Recent' ? <IconClock /> : command.icon,
    shortcut: command.shortcutId !== undefined ? shortcutLabel(command.shortcutId) : undefined,
    onSelect: () => trackAndClose(command.id, command.action),
  };
}
