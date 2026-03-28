/**
 * shared/stores — Global Zustand stores.
 *
 * All stores here manage business logic or persistent user state.
 * Transient UI state should use React Context or component-level useState.
 *
 * Audit status (2026-03-28):
 *   - All stores classified as business logic or persistence-dependent.
 *   - Mixed stores (business + transient UI) document their rationale
 *     in NOTE comments at the top of each file.
 *   - Transient-only UI stores have been converted to React Context
 *     (e.g., panel-controls-store -> PanelControlsContext).
 */

// ---- Business logic stores ----
export { useAuthStore } from './auth-store';
export { useWorkspaceStore } from './workspace-store';
export { useSearchStore } from './search-store';
export type { SavedSearch, SearchStoreState } from './search-store';
export { useNotificationStore } from './notification-store';
export { useActivityStore } from './activity-store';
export {
  useCommentStore,
  selectThreadsArray,
  selectFilteredThreads,
  selectUnresolvedCount,
  selectTotalCommentCount,
  selectThreadById,
} from './comment-store';
export type { Comment, CommentThread, CommentTextRange, CommentFilterMode } from './comment-store';
export { useShortcutStore } from './shortcut-store';
export type { ShortcutStoreState } from './shortcut-store';
export {
  useOnboardingStore,
  selectCurrentStepConfig,
  selectProgressPercent,
  shouldShowOnboarding,
  ONBOARDING_STEPS,
} from './onboarding-store';
export type { OnboardingStepId, OnboardingStepConfig } from './onboarding-store';

// ---- Layout / UI persistence stores ----
// These stores contain persisted user preferences and workspace layout.
// Kept in Zustand for localStorage persistence. Each file documents
// the business rationale for keeping state in Zustand.
export { useLayoutStore } from './layout-store';
export type { PanelConfig, TabConfig, LayoutConfig, GridLayoutConfig } from './layout-store';
export { useTabStore } from './tab-store';
export type { Tab } from './tab-store';
export {
  useWorkspaceGraphStore,
  computeActiveFilterCount,
  selectGraphFilters,
  selectGraphPresets,
} from './graph-store';
export type {
  WorkspaceGraphFilters,
  GraphDateRange,
  HighlightedNode,
  GraphFilterPreset,
} from './graph-store';
export { useSidebarStore } from './sidebar-store';
export type { PanelConfig as SidebarPanelConfig } from './sidebar-store';
export { useThemePreferencesStore } from './theme-store';
export type { ThemePreferences } from './theme-store';
export {
  useRibbonStore,
  getActionDefinition,
  getVisibleActions,
  registerRibbonAction,
  DEFAULT_RIBBON_ACTIONS,
} from './ribbon-store';
export type { RibbonAction, BuiltInRibbonActionId } from './ribbon-store';
export {
  useFavoritesStore,
  selectFavoritesCount,
  selectIsFavoritesFull,
  MAX_FAVORITES,
} from './favorites-store';
export type { FavoriteEntry } from './favorites-store';
export { useRecentStore, MAX_RECENT_NOTES } from './recent-store';
export type { RecentNoteEntry } from './recent-store';

// ---- Presence ----
export {
  usePresenceStore,
  selectPresenceUsers,
  selectUsersOnNote,
  selectNoteViewerCounts,
  selectOnlineUserCount,
} from './presence-store';
export type { PresenceStatus, WorkspacePresenceUser } from './presence-store';
