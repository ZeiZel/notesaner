/**
 * features/shortcuts — public API (FSD barrel export).
 *
 * Centralized keyboard shortcut management for Notesaner.
 *
 * Provides:
 *   - ShortcutProvider — global provider that starts the manager and hosts the cheatsheet
 *   - ShortcutCheatsheet — overlay showing all shortcuts (Cmd+/ to toggle)
 *   - usePluginShortcut — hook for plugins to register shortcuts
 *   - Platform utilities for Cmd/Ctrl display
 *
 * The underlying manager, store, and types are in shared/lib and shared/stores
 * (lower FSD layer). This feature composes them into user-facing functionality.
 */

// ---- UI components ----
export { ShortcutProvider } from './ui/ShortcutProvider';
export type { ShortcutProviderProps } from './ui/ShortcutProvider';

export { ShortcutCheatsheet } from './ui/ShortcutCheatsheet';
export type { ShortcutCheatsheetProps } from './ui/ShortcutCheatsheet';

export { KeyCaptureInput } from './ui/KeyCaptureInput';
export type { KeyCaptureInputProps } from './ui/KeyCaptureInput';

// ---- Plugin integration ----
export { usePluginShortcut } from './lib/use-plugin-shortcut';
export type { UsePluginShortcutOptions } from './lib/use-plugin-shortcut';

// ---- Platform utilities ----
export {
  isMacPlatform,
  getModifierLabel,
  getModifierSymbol,
  getShiftSymbol,
  getAltSymbol,
} from './lib/platform';
