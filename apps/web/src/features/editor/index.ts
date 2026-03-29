/**
 * features/editor — public API barrel export.
 *
 * This is the only import path that pages/widgets should use for editor components.
 * Internal implementation details (individual files in ui/, model/, lib/, hooks/)
 * are encapsulated and should not be imported directly from outside this feature.
 *
 * FSD rule: only import from this index.ts in higher layers.
 */

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

export { EditorModeToggle } from './ui/EditorModeToggle';
export type { EditorModeToggleProps } from './ui/EditorModeToggle';

export { EditorModeWrapper } from './ui/EditorModeWrapper';
export type { EditorModeWrapperProps } from './ui/EditorModeWrapper';

export { SourceModeEditor } from './ui/SourceModeEditor';
export type { SourceModeEditorProps } from './ui/SourceModeEditor';

export { LivePreviewEditor } from './ui/LivePreviewEditor';
export type { LivePreviewEditorProps } from './ui/LivePreviewEditor';

export { ReadingModeView } from './ui/ReadingModeView';
export type { ReadingModeViewProps } from './ui/ReadingModeView';

export { PropertyValueEditor } from './ui/PropertyValueEditor';
export type { PropertyValueEditorProps } from './ui/PropertyValueEditor';

export { TitleEditor, TagsEditor, AliasesEditor } from './ui/SpecialPropertyEditors';
export type {
  TitleEditorProps,
  TagsEditorProps,
  AliasesEditorProps,
} from './ui/SpecialPropertyEditors';

export { CommentSidebar } from './ui/CommentSidebar';
export type { CommentSidebarProps } from './ui/CommentSidebar';

export { CommentThread } from './ui/CommentThread';
export type { CommentThreadProps } from './ui/CommentThread';

export { DiffViewer, computeLineDiff } from './ui/DiffViewer';
export type { DiffViewerProps, DiffChange, DiffViewMode } from './ui/DiffViewer';

export { ExportDialog } from './ui/ExportDialog';
export type { ExportDialogProps, ExportFormat, ExportMode } from './ui/ExportDialog';

export { PrintView } from './ui/PrintView';
export type { PrintViewProps } from './ui/PrintView';

export { HistoryPanel } from './ui/HistoryPanel';
export type { HistoryPanelProps } from './ui/HistoryPanel';

export { InlineComment } from './ui/InlineComment';
export type { InlineCommentProps } from './ui/InlineComment';

export { PresenceAvatar } from './ui/PresenceAvatar';
export type { PresenceAvatarProps, PresenceAvatarUser } from './ui/PresenceAvatar';

export { PresenceDot } from './ui/PresenceDot';
export type { PresenceDotProps, PresenceDotUser } from './ui/PresenceDot';

export { PresenceIndicator } from './ui/PresenceIndicator';
export type { PresenceIndicatorProps } from './ui/PresenceIndicator';

export { ShareDialog } from './ui/ShareDialog';

export { ShareLinkManager } from './ui/ShareLinkManager';

export { UndoRedoToolbar } from './ui/UndoRedoToolbar';
export type { UndoRedoToolbarProps } from './ui/UndoRedoToolbar';

export { VersionHistory } from './ui/VersionHistory';
export type { VersionHistoryProps } from './ui/VersionHistory';

export { FocusMode, FocusModeButton } from './ui/FocusMode';
export type { FocusModeProps, FocusModeButtonProps } from './ui/FocusMode';

export {
  MermaidToolbarButton,
  MermaidExtensionWarning,
  MermaidStandalonePreview,
} from './ui/MermaidPreview';
export type { MermaidToolbarButtonProps, MermaidStandalonePreviewProps } from './ui/MermaidPreview';

// ---------------------------------------------------------------------------
// Model (stores, types, selectors)
// ---------------------------------------------------------------------------

export {
  useEditorModeStore,
  selectIsEditing,
  selectIsSourceBased,
  readingFontFamilyCss,
  EDITOR_MODE_LABELS,
} from './model/editor-mode.store';
export type {
  EditMode,
  EditorMode,
  ReadingFontFamily,
  ReadingSettings,
  EditorModeState,
} from './model/editor-mode.store';

export {
  useFrontmatterStore,
  selectProperty,
  selectSortedProperties,
  selectCustomProperties,
  selectSpecialProperties,
  SPECIAL_KEYS,
} from './model/frontmatter.store';

export {
  useHistoryStore,
  selectCanUndo,
  selectCanRedo,
  selectUndoEntry,
  selectRedoEntry,
  selectPastEntries,
  selectFutureEntries,
  describeContentChange,
  describeFormatAction,
} from './model/history.store';
export type { HistoryActionType, HistoryEntry, HistoryState } from './model/history.store';

export { useFocusModeStore } from './model/focus-mode-store';
export type { FocusModeState } from './model/focus-mode-store';

// ---------------------------------------------------------------------------
// Lib (parser, utilities)
// ---------------------------------------------------------------------------

export {
  parseFrontmatter,
  serializeFrontmatter,
  buildMarkdown,
  detectValueType,
  coerceValue,
  parseInlineArray,
} from './lib/frontmatter-parser';
export type {
  FrontmatterValueType,
  FrontmatterProperty,
  FrontmatterMap,
} from './lib/frontmatter-parser';

export {
  createCollaborationCursor,
  createCursorActivityTracker,
  cleanupCollaborationCursors,
} from './lib/collaboration-cursor';
export type { CollaborationUser, CollaborationCursorOptions } from './lib/collaboration-cursor';

export { useNoteCssClass } from './lib/use-note-css-class';

export { usePrint, usePrintShortcut } from './lib/use-print';
export type { UsePrintOptions, UsePrintReturn, UsePrintShortcutOptions } from './lib/use-print';

export { CommentMark, COMMENT_MARK_CSS, COMMENT_MARK_CLICK_KEY } from './lib/comment-mark';
export type { CommentMarkAttributes, CommentMarkOptions } from './lib/comment-mark';

export {
  DropUploadExtension,
  isAcceptedDropFile,
  extractImageFilesFromClipboard,
  getFileExtension,
} from './lib/drop-upload-extension';
export type { DropUploadOptions } from './lib/drop-upload-extension';

export { EditorDropZone } from './ui/EditorDropZone';
export type {
  EditorDropZoneProps,
  UploadEntry,
  UploadStatus,
  EditorDropZoneFilesHandler,
} from './ui/EditorDropZone';

export {
  createMermaidExtension,
  insertMermaidBlock,
  hasMermaidExtension,
  MERMAID_TOOLBAR_ITEMS,
  getMermaidStarter,
  detectDiagramType,
  resolveMermaidTheme,
  MERMAID_DIAGRAM_TYPES,
  MERMAID_STARTERS,
} from './lib/mermaid-extension';
export type {
  MermaidBlockOptions,
  MermaidDiagramType,
  MermaidTheme,
  MermaidToolbarItem,
} from './lib/mermaid-extension';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export {
  useVersionHistory,
  useVersionContent,
  useRestoreVersion,
  versionKeys,
} from './hooks/useVersionHistory';

export { useEditorComments } from './hooks/useEditorComments';
export type { UseEditorCommentsOptions, UseEditorCommentsReturn } from './hooks/useEditorComments';
