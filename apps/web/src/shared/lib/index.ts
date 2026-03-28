/**
 * shared/lib — Utility functions, helpers, and framework-agnostic modules.
 *
 * This segment contains pure logic with no UI rendering.
 * React hooks belong in shared/hooks, not here.
 */

// ---- Core utilities ----
export {
  cn,
  formatDate,
  formatRelativeTime,
  debounce,
  truncate,
  pathToDisplayName,
  getPresenceColor,
} from './utils';

// ---- Accessibility utilities ----
export {
  announceToScreenReader,
  useFocusTrap,
  useReducedMotion,
  generateId,
  useA11yId,
  useArrowNavigation,
  visuallyHiddenStyle,
  FOCUSABLE_SELECTOR,
} from './a11y';

// ---- Clipboard ----
export {
  copyText,
  copyRichText,
  copyCodeBlock,
  copyNoteLink,
  copyBlockReference,
  copyNoteTitle,
} from './clipboard';
export type { ClipboardWriteOptions, ClipboardFormat } from './clipboard';

// ---- Keyboard shortcuts (definitions + manager) ----
export {
  KEYBOARD_SHORTCUTS,
  matchesCombo,
  getGlobalShortcuts,
  formatCombo,
} from './keyboard-shortcuts';
export type {
  KeyCombo,
  KeyboardShortcut,
  ShortcutCategory,
  ShortcutId,
} from './keyboard-shortcuts';
export {
  keyboardManager,
  serializeCombo,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from './keyboard-manager';
export type {
  ShortcutScope,
  RegisteredHandler,
  ShortcutConflict,
  ResolvedShortcut,
} from './keyboard-manager';

// ---- Search query parser ----
export { parseSearchQuery, tokenize, buildSearchQuery, SEARCH_OPERATORS } from './search-parser';
export type {
  ParsedSearch,
  DateFilter,
  DateOperator,
  HasFilter,
  SearchOperatorDoc,
} from './search-parser';

// ---- Lazy loading ----
export { lazyLoad, preloadComponent, preloadOnHover } from './lazy';
export type { LazyLoadOptions } from './lazy';

// ---- Lazy-loaded component registry ----
export {
  LazyLocalGraphPanel,
  LazySettingsDialog,
  LazyPluginBrowser,
  LazyPluginSettingsPage,
  LazyAuditLogViewer,
  LazyAnalyticsDashboard,
  LazyDomainSettings,
  LazyPublicThemeSettings,
  LazyCommentModerationQueue,
  LazyPropertiesPanel,
  LazyUnlinkedMentionsPanel,
  LazyCommandPaletteDialog,
  preloadGraph,
  preloadSettings,
  preloadPluginBrowser,
  preloadAuditLog,
} from './lazy-components';

// ---- Theme system ----
// Re-exported via sub-path: import { useTheme, ThemeToggle } from '@/shared/lib/theme';
// Not flattened here to avoid naming collisions.
