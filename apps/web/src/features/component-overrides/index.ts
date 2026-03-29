// ── UI components ─────────────────────────────────────────────────────────────
export {
  ComponentOverridesPage,
  type ComponentOverridesPageProps,
} from './ui/ComponentOverridesPage';
export { OverrideEditor, type OverrideEditorProps } from './ui/OverrideEditor';
export {
  OverrideSandboxPreview,
  type OverrideSandboxPreviewProps,
} from './ui/OverrideSandboxPreview';
export { OverrideAuditDrawer, type OverrideAuditDrawerProps } from './ui/OverrideAuditDrawer';

// ── Model (stores) ─────────────────────────────────────────────────────────────
export {
  useOverridesStore,
  selectOverrideOp,
  type OverrideOpStatus,
  type OverrideOpState,
} from './model/overrides-store';

// ── API ────────────────────────────────────────────────────────────────────────
export { componentOverridesApi } from './api/component-overrides-api';

// ── Lib ────────────────────────────────────────────────────────────────────────
export { buildTypeDefinitions } from './lib/override-type-defs';
