// ── UI components ────────────────────────────────────────────────────────────
export { PluginBrowser, type PluginBrowserProps } from './ui/PluginBrowser';
export { PluginCard, type PluginCardProps } from './ui/PluginCard';
export { PluginDetailModal, type PluginDetailModalProps } from './ui/PluginDetailModal';
export { PluginSettingsPage, type PluginSettingsPageProps } from './ui/PluginSettingsPage';
export {
  PluginSettingsRenderer,
  type PluginSettingsRendererProps,
} from './ui/PluginSettingsRenderer';

// ── Model (stores) ──────────────────────────────────────────────────────────
export {
  usePluginBrowserStore,
  selectBrowserPluginOp,
  type BrowserOpStatus,
  type PluginBrowserOpState,
} from './model/plugin-browser-store';

// ── API ─────────────────────────────────────────────────────────────────────
export {
  pluginRegistryApi,
  type RegistryPlugin,
  type RegistrySearchResult,
  type RegistrySortBy,
  type RegistrySearchParams,
  type InstallPluginPayload,
  type InstalledPluginResponse,
} from './api/plugin-registry-api';

// ── Lib ─────────────────────────────────────────────────────────────────────
export {
  schemaToFields,
  buildDefaultValues,
  validateSettings,
  errorsByKey,
  type FieldDescriptor,
  type FieldType,
  type FieldValidation,
  type SelectOption,
  type ValidationError,
} from './lib/schema-to-form';
