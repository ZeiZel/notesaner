// ── UI components ────────────────────────────────────────────────────────────
export { PublicSearchBar } from './ui/PublicSearchBar';
export { PublicSearchResults } from './ui/PublicSearchResults';
export { ReaderComments } from './ui/ReaderComments';
export { CommentModerationQueue } from './ui/CommentModerationQueue';
export { AnalyticsDashboard } from './ui/AnalyticsDashboard';
export { DomainSettings } from './ui/DomainSettings';
export { PublicBreadcrumb } from './ui/PublicBreadcrumb';
export { PublicNavigation } from './ui/PublicNavigation';
export { PublicSidebar, type PublicNoteTreeNode } from './ui/PublicSidebar';
export { PublicThemePreview } from './ui/PublicThemePreview';
export { PublicThemeProvider, usePublicTheme } from './ui/PublicThemeProvider';
export { PublicThemeSettings } from './ui/PublicThemeSettings';
export { PublishedNote } from './ui/PublishedNote';

// ── Model (stores, types, themes) ───────────────────────────────────────────
export { usePublicSearchStore } from './model/public-search-store';
export type { PublicSearchStatus } from './model/public-search-store';
export { useReaderCommentsStore } from './model/reader-comments-store';
export type {
  PublicReaderComment,
  ReaderCommentAdminItem,
  CommentSubmitStatus,
  CommentsLoadStatus,
} from './model/reader-comments-store';
export { useAnalyticsStore, analyticsKeys } from './model/analytics-store';
export { useDomainStore } from './model/domain-store';
export type {
  DomainStatusDto,
  DomainVerificationStatus,
  DnsInstructions,
} from './model/domain-store';
export { usePublicThemeStore } from './model/public-theme-store';
export {
  PUBLIC_BUILT_IN_THEMES,
  PUBLIC_FONT_PRESETS,
  type PublicThemeId,
  type PublicFontFamily,
  type PublicTheme,
  generateThemeCssVars,
  generateTypographyCssVars,
  sanitizeCustomCss,
  findPublicThemeById,
} from './model/public-themes';

// ── API ─────────────────────────────────────────────────────────────────────
export {
  getPublishedNote,
  getPublishedNoteOrNotFound,
  getVaultIndex,
  getAllPublishedNotes,
  noteTag,
  vaultTag,
} from './api/fetch-published-note';
export type {
  PublishedNoteData,
  VaultIndexData,
  PublishedNoteItem,
} from './api/fetch-published-note';

// ── Lib ─────────────────────────────────────────────────────────────────────
export { renderNote, type RenderedNote, type TocEntry } from './lib/render-note';
export { generateNoteMetadata, generateVaultMetadata } from './lib/generate-metadata';
