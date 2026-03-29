// TipTap editor core configuration
// Will contain: base extensions, custom nodes (wiki links, callouts), marks, serializers
export const EDITOR_CORE_VERSION = '0.0.0';

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

// Highlight mark (text highlighting with multiple colors)
export {
  Highlight,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_VALUES,
  HIGHLIGHT_INPUT_REGEX,
  resolveHighlightColor,
  serializeHighlight,
  type HighlightAttrs,
  type HighlightColor,
  type HighlightOptions,
} from './extensions/highlight';

// Comment mark (inline comment annotations attached to text ranges)
export {
  CommentMark,
  COMMENT_MARK_PLUGIN_KEY,
  COMMENT_MARK_ACTIVE_BG,
  COMMENT_MARK_RESOLVED_BG,
  COMMENT_MARK_ACTIVE_BORDER,
  COMMENT_MARK_RESOLVED_BORDER,
  type CommentMarkAttrs,
  type CommentMarkOptions,
} from './extensions/comment-mark';

// Toggle list (collapsible details/summary)
export {
  ToggleList,
  ToggleListSummary,
  ToggleListBody,
  TOGGLE_LIST_INPUT_REGEX,
  serializeToggleList,
  type ToggleListAttrs,
  type ToggleListOptions,
} from './extensions/toggle-list';

// Callout block (info, warning, tip, danger, note)
export {
  CalloutBlock,
  CALLOUT_TYPES,
  CALLOUT_ALIASES,
  CALLOUT_DEFAULT_TITLES,
  CALLOUT_INPUT_REGEX,
  resolveCalloutType,
  type CalloutBlockAttrs,
  type CalloutBlockOptions,
  type CalloutType,
} from './extensions/callout-block';

// Enhanced code block with syntax highlighting
export {
  CodeBlockEnhanced,
  COMMON_LANGUAGES,
  LANGUAGE_ALIASES,
  CODE_BLOCK_INPUT_REGEX,
  resolveLanguage,
  type CodeBlockEnhancedAttrs,
  type CodeBlockEnhancedOptions,
} from './extensions/code-block-enhanced';

// Typography improvements (smart quotes, em-dashes, ellipses, etc.)
export {
  TypographyEnhanced,
  EM_DASH,
  EN_DASH,
  ELLIPSIS,
  LEFT_DOUBLE_QUOTE,
  RIGHT_DOUBLE_QUOTE,
  LEFT_SINGLE_QUOTE,
  RIGHT_SINGLE_QUOTE,
  RIGHT_ARROW,
  LEFT_ARROW,
  DOUBLE_RIGHT_ARROW,
  COPYRIGHT,
  REGISTERED,
  TRADEMARK,
  PLUS_MINUS,
  MULTIPLICATION,
  ONE_HALF,
  ONE_QUARTER,
  THREE_QUARTERS,
  type TypographyEnhancedOptions,
} from './extensions/typography-enhanced';

// Vim keybinding mode
export {
  VimMode,
  VIM_MODE_PLUGIN_KEY,
  VIM_MODE_CHANGE_EVENT,
  type VimModeType,
  type VimState,
  type VimModeOptions,
} from './extensions/vim-mode';

// Heading fold (fold/collapse content under headings)
export {
  HeadingFold,
  HEADING_FOLD_PLUGIN_KEY,
  collectHeadings,
  computeFoldRange,
  mapFoldedPositions,
  serializeFoldState,
  deserializeFoldState,
  type HeadingFoldOptions,
  type HeadingFoldPluginState,
  type HeadingInfo,
} from './extensions/heading-fold';

// Relationship types (Zettelkasten link annotations)
export {
  BUILT_IN_RELATIONSHIP_TYPES,
  type RelationshipTypeDef,
} from './extensions/relationship-types';

// Block reference (selection-based block reference creation)
export {
  BlockReference,
  generateBlockId,
  extractBlockRefId,
  buildReferenceString,
  buildBlockRefSuffix,
  hasBlockRef,
  isValidBlockRefId,
  collectBlockRefIds,
  generateUniqueBlockId,
  BLOCK_REF_REGEX,
  BLOCK_REF_ID_REGEX,
  type BlockReferenceOptions,
} from './extensions/block-reference';

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { HighlightMenu, getActiveHighlightColor } from './components/HighlightMenu';
export type { HighlightMenuProps } from './components/HighlightMenu';

export { ToggleListNodeView } from './components/ToggleListView';
export type { ToggleListNodeViewComponent } from './components/ToggleListView';

// Callout block view
export { CalloutBlockView } from './components/CalloutBlockView';

// Code block view
export { CodeBlockView } from './components/CodeBlockView';

// Vim status line
export { VimStatusLine } from './components/VimStatusLine';
export type { VimStatusLineProps } from './components/VimStatusLine';

// Heading fold toggle view
export { HeadingFoldView } from './components/HeadingFoldView';
export type { HeadingFoldViewProps } from './components/HeadingFoldView';

// Mermaid diagram block
export {
  MermaidBlock,
  detectDiagramType,
  resolveMermaidTheme,
  getMermaidStarter,
  MERMAID_DIAGRAM_TYPES,
  MERMAID_STARTERS,
} from './extensions/mermaid-block';
export type {
  MermaidBlockOptions,
  MermaidBlockAttrs,
  MermaidDiagramType,
  MermaidTheme,
} from './extensions/mermaid-block';
