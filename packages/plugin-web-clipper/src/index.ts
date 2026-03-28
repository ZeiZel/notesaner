/**
 * @notesaner/plugin-web-clipper
 *
 * Browser extension SDK for clipping web content to Notesaner.
 * Provides HTML→Markdown conversion, readability extraction,
 * clip templates, Zustand store, API client, and React popup UI.
 */

export const PLUGIN_ID = 'web-clipper';

// HTML to Markdown converter
export {
  htmlToMarkdown,
  resolveUrl,
  removeTrackingParams,
  decodeHtmlEntities,
} from './html-to-markdown';
export type { HtmlToMarkdownOptions } from './html-to-markdown';

// Readability article extractor
export {
  extractArticle,
  extractTitle,
  extractAuthor,
  extractPublishedDate,
  extractCanonicalUrl,
  extractSiteName,
  extractMainContent,
  makeExcerpt,
} from './readability';
export type { ArticleMetadata } from './readability';

// Clip templates
export {
  renderTemplate,
  getDefaultTemplate,
  titleToFilename,
  TEMPLATE_ARTICLE,
  TEMPLATE_BOOKMARK,
  TEMPLATE_HIGHLIGHT,
  TEMPLATE_SCREENSHOT,
  DEFAULT_TEMPLATES,
} from './clip-templates';
export type { ClipTemplate, TemplateContext } from './clip-templates';

// Zustand clip store
export { useClipperStore } from './clip-store';
export type {
  ClipMode,
  ClipDestination,
  ClipHistoryEntry,
  ConnectionStatus,
  ClipperState,
  ClipperActions,
} from './clip-store';

// Notesaner API client
export {
  authenticate,
  createNote,
  uploadImage,
  listFolders,
  listTags,
  ApiError,
} from './api-client';
export type {
  ApiClientConfig,
  NoteCreatePayload,
  NoteCreateResult,
  FolderItem,
  TagItem,
  UploadImageResult,
  AuthValidateResult,
} from './api-client';

// Content script helpers
export {
  getSelectedHTML,
  getPageHTML,
  getFullPageHTML,
  getPageMetadata,
  captureVisibleTab,
} from './content-script';
export type { PageMetadata } from './content-script';

// React UI components
export { ClipperPopup } from './ClipperPopup';
export type { ClipperPopupProps } from './ClipperPopup';

export { ClipperSettings } from './ClipperSettings';
export type { ClipperSettingsProps } from './ClipperSettings';

export type { FolderOption } from './ClipperPopup.types';
