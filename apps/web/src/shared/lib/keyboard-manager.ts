/**
 * keyboard-manager.ts — Central keyboard shortcut registry with conflict detection.
 *
 * This module provides a singleton registry that:
 *  1. Maintains the canonical set of shortcuts (defaults + user overrides)
 *  2. Detects conflicts (two actions bound to the same key combo in the same scope)
 *  3. Supports scope-based priority: editor > workspace > global
 *  4. Enables runtime registration/deregistration of shortcut handlers
 *
 * The manager is intentionally framework-agnostic (no React dependencies).
 * React integration is handled via useKeyboardShortcut hook.
 */

import {
  KEYBOARD_SHORTCUTS,
  matchesCombo,
  formatCombo,
  type KeyCombo,
  type KeyboardShortcut,
  type ShortcutCategory,
} from './keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Scope determines where the shortcut fires and its priority.
 * Higher-priority scopes consume the event before lower ones.
 */
export type ShortcutScope = 'editor' | 'workspace' | 'global';

/**
 * Priority order: editor shortcuts win over workspace, workspace over global.
 * Lower number = higher priority.
 */
const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  editor: 0,
  workspace: 1,
  global: 2,
} as const;

/** A handler registered for a specific shortcut action. */
export interface RegisteredHandler {
  /** The shortcut action ID this handler responds to. */
  actionId: string;
  /** The scope this handler operates in. */
  scope: ShortcutScope;
  /** The callback invoked when the shortcut fires. */
  handler: () => void;
  /** When true, this registration is temporarily suspended. */
  enabled: boolean;
}

/** Describes a conflict between two shortcut bindings. */
export interface ShortcutConflict {
  /** Serialized combo string (e.g. "mod+shift+f"). */
  comboKey: string;
  /** Human-readable combo (e.g. "Cmd+Shift+F"). */
  comboLabel: string;
  /** The action IDs that share this combo. */
  actionIds: string[];
  /** The scope where the conflict occurs. */
  scope: ShortcutScope;
}

/** A resolved shortcut entry with effective combo (accounting for overrides). */
export interface ResolvedShortcut extends KeyboardShortcut {
  /** The effective combo after applying user overrides. */
  effectiveCombo: KeyCombo;
  /** Whether this shortcut has been overridden by the user. */
  isOverridden: boolean;
  /** Conflicts with other shortcuts in the same scope. */
  conflicts: string[];
}

// ---------------------------------------------------------------------------
// Combo serialization (for conflict detection)
// ---------------------------------------------------------------------------

/**
 * Serializes a KeyCombo into a canonical string for comparison.
 * Two combos that produce the same serialized key are considered identical.
 */
export function serializeCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.mod) parts.push('mod');
  if (combo.ctrl) parts.push('ctrl');
  if (combo.shift) parts.push('shift');
  if (combo.alt) parts.push('alt');
  parts.push(combo.key.toLowerCase());
  return parts.join('+');
}

// ---------------------------------------------------------------------------
// KeyboardManager — singleton registry
// ---------------------------------------------------------------------------

type ChangeListener = () => void;

class KeyboardManager {
  /** User-defined overrides: actionId -> KeyCombo | null (null = disabled). */
  private overrides = new Map<string, KeyCombo | null>();

  /** Active handler registrations. */
  private handlers = new Map<string, RegisteredHandler>();

  /** Listeners notified when the registry changes. */
  private changeListeners = new Set<ChangeListener>();

  /** Whether the global keydown listener is attached. */
  private isListening = false;

  /** Bound reference for cleanup. */
  private boundKeyDownHandler = this.handleKeyDown.bind(this);

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start listening for keyboard events on the window.
   * Safe to call multiple times — only attaches once.
   */
  start(): void {
    if (this.isListening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.boundKeyDownHandler, { capture: false });
    this.isListening = true;
  }

  /**
   * Stop listening for keyboard events.
   */
  stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.boundKeyDownHandler);
    this.isListening = false;
  }

  // -------------------------------------------------------------------------
  // Handler registration
  // -------------------------------------------------------------------------

  /**
   * Register a handler for a shortcut action.
   * Returns an unregister function for cleanup.
   */
  register(actionId: string, scope: ShortcutScope, handler: () => void): () => void {
    const key = `${scope}:${actionId}`;
    this.handlers.set(key, {
      actionId,
      scope,
      handler,
      enabled: true,
    });
    this.notifyChange();

    return () => {
      this.handlers.delete(key);
      this.notifyChange();
    };
  }

  /**
   * Temporarily enable/disable a handler without unregistering it.
   */
  setHandlerEnabled(actionId: string, scope: ShortcutScope, enabled: boolean): void {
    const key = `${scope}:${actionId}`;
    const registration = this.handlers.get(key);
    if (registration) {
      registration.enabled = enabled;
    }
  }

  // -------------------------------------------------------------------------
  // Override management
  // -------------------------------------------------------------------------

  /**
   * Apply user overrides from an external source (e.g. Zustand store).
   * Replaces all existing overrides.
   */
  setOverrides(overrides: Record<string, KeyCombo | null>): void {
    this.overrides.clear();
    for (const [id, combo] of Object.entries(overrides)) {
      this.overrides.set(id, combo);
    }
    this.notifyChange();
  }

  /**
   * Get the effective combo for a shortcut (override or default).
   * Returns null if the shortcut is disabled via override.
   */
  getEffectiveCombo(actionId: string): KeyCombo | null {
    if (this.overrides.has(actionId)) {
      return this.overrides.get(actionId) ?? null;
    }
    const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === actionId);
    return shortcut?.combo ?? null;
  }

  // -------------------------------------------------------------------------
  // Conflict detection
  // -------------------------------------------------------------------------

  /**
   * Detects all shortcut conflicts in the current binding set.
   * A conflict occurs when two or more actions in overlapping scopes
   * share the same key combo.
   */
  detectConflicts(): ShortcutConflict[] {
    const comboMap = new Map<string, { actionId: string; scope: ShortcutScope }[]>();

    for (const shortcut of KEYBOARD_SHORTCUTS) {
      const combo = this.getEffectiveCombo(shortcut.id);
      if (!combo) continue; // Disabled shortcut

      const scope = shortcut.scope === 'editor' ? 'editor' : 'global';
      const key = `${scope}:${serializeCombo(combo)}`;

      if (!comboMap.has(key)) {
        comboMap.set(key, []);
      }
      comboMap.get(key)?.push({ actionId: shortcut.id, scope });
    }

    const conflicts: ShortcutConflict[] = [];
    for (const [key, entries] of comboMap) {
      if (entries.length > 1) {
        const scope = entries[0].scope;
        const combo = this.getEffectiveCombo(entries[0].actionId);
        if (!combo) continue;
        conflicts.push({
          comboKey: key,
          comboLabel: formatCombo(combo),
          actionIds: entries.map((e) => e.actionId),
          scope,
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if a specific combo would conflict with existing bindings
   * in the given scope, excluding a specific action ID.
   */
  wouldConflict(combo: KeyCombo, scope: ShortcutScope, excludeActionId?: string): string[] {
    const serialized = serializeCombo(combo);
    const conflicting: string[] = [];

    for (const shortcut of KEYBOARD_SHORTCUTS) {
      if (shortcut.id === excludeActionId) continue;

      const effectiveCombo = this.getEffectiveCombo(shortcut.id);
      if (!effectiveCombo) continue;

      const shortcutScope = shortcut.scope === 'editor' ? 'editor' : 'global';

      // Conflict only matters within the same scope or overlapping scopes
      if (shortcutScope === scope || scope === 'global' || shortcutScope === 'global') {
        if (serializeCombo(effectiveCombo) === serialized) {
          conflicting.push(shortcut.id);
        }
      }
    }

    return conflicting;
  }

  // -------------------------------------------------------------------------
  // Resolution
  // -------------------------------------------------------------------------

  /**
   * Returns all shortcuts with their effective combos, override status,
   * and any conflicts. Used by the settings UI.
   */
  getResolvedShortcuts(): ResolvedShortcut[] {
    const conflicts = this.detectConflicts();
    const conflictIndex = new Map<string, string[]>();

    for (const conflict of conflicts) {
      for (const actionId of conflict.actionIds) {
        const others = conflict.actionIds.filter((id) => id !== actionId);
        const existing = conflictIndex.get(actionId) ?? [];
        conflictIndex.set(actionId, [...existing, ...others]);
      }
    }

    return KEYBOARD_SHORTCUTS.map((shortcut) => {
      const effectiveCombo = this.getEffectiveCombo(shortcut.id);
      return {
        ...shortcut,
        effectiveCombo: effectiveCombo ?? shortcut.combo,
        isOverridden: this.overrides.has(shortcut.id),
        conflicts: conflictIndex.get(shortcut.id) ?? [],
      };
    });
  }

  // -------------------------------------------------------------------------
  // Event handling
  // -------------------------------------------------------------------------

  private handleKeyDown(event: KeyboardEvent): void {
    // Skip when focus is inside a native text input (not ProseMirror)
    const target = event.target as HTMLElement | null;
    if (target && this.isNativeTextInput(target)) {
      return;
    }

    // Determine current scope based on focus
    const currentScope = this.detectCurrentScope(target);

    // Collect all matching handlers, sorted by scope priority
    const matches: { registration: RegisteredHandler; priority: number }[] = [];

    for (const registration of this.handlers.values()) {
      if (!registration.enabled) continue;

      const combo = this.getEffectiveCombo(registration.actionId);
      if (!combo) continue; // Disabled

      if (matchesCombo(event, combo)) {
        const priority = SCOPE_PRIORITY[registration.scope];
        // Only fire if the handler's scope is active
        if (this.isScopeActive(registration.scope, currentScope)) {
          matches.push({ registration, priority });
        }
      }
    }

    if (matches.length === 0) return;

    // Sort by priority (lower = higher priority) and fire the winner
    matches.sort((a, b) => a.priority - b.priority);
    const winner = matches[0];

    event.preventDefault();
    winner.registration.handler();
  }

  /**
   * Determines the current scope based on the focused element.
   */
  private detectCurrentScope(target: HTMLElement | null): ShortcutScope {
    if (!target) return 'global';

    // Check if focus is in the editor
    if (target.classList.contains('ProseMirror') || target.closest('.ProseMirror') !== null) {
      return 'editor';
    }

    // Check if focus is in any workspace panel
    if (target.closest('[data-scope="workspace"]') !== null) {
      return 'workspace';
    }

    return 'global';
  }

  /**
   * Returns true if the handler scope is valid for the current scope.
   * Global handlers fire everywhere; workspace handlers fire in workspace + editor;
   * editor handlers only fire in the editor.
   */
  private isScopeActive(handlerScope: ShortcutScope, currentScope: ShortcutScope): boolean {
    const handlerPriority = SCOPE_PRIORITY[handlerScope];
    const currentPriority = SCOPE_PRIORITY[currentScope];
    // Handler fires if its scope is equal or broader than the current scope
    return handlerPriority >= currentPriority;
  }

  /**
   * Returns true for native text-entry elements that should NOT trigger shortcuts.
   */
  private isNativeTextInput(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();

    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return true;
    }

    if (el.isContentEditable) {
      // Allow shortcuts from ProseMirror editor
      if (el.classList.contains('ProseMirror')) {
        return false;
      }
      return true;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Change notification (for useSyncExternalStore)
  // -------------------------------------------------------------------------

  subscribe(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  getSnapshot(): number {
    return this._version;
  }

  private _version = 0;

  private notifyChange(): void {
    this._version++;
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

/** The global keyboard manager instance. */
export const keyboardManager = new KeyboardManager();

// ---------------------------------------------------------------------------
// Category helpers (reusable by UIs)
// ---------------------------------------------------------------------------

/** Human-readable category labels for display. */
export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  workspace: 'Workspace',
  editor: 'Editor',
  view: 'View',
};

/** Category display order. */
export const CATEGORY_ORDER: ShortcutCategory[] = ['navigation', 'workspace', 'editor', 'view'];
