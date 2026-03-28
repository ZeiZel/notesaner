export const PLUGIN_ID = 'templates';

// Template engine
export { renderTemplate, extractVariables, getRequiredCustomVariables } from './template-engine';
export type {
  RenderContext,
  RenderResult,
  TemplateVariable,
  BuiltInVariable,
} from './template-engine';

// Template parser
export { parseTemplateFile, serializeTemplate } from './template-parser';
export type { TemplateMeta, TemplateVariableMeta, ParsedTemplate } from './template-parser';

// Template store
export { useTemplateStore } from './template-store';
export type {
  TemplateEntry,
  TemplateState,
  TemplateActions,
  PickerContext,
  CustomVariableValues,
} from './template-store';

// Built-in templates
export { BUILT_IN_TEMPLATES, getBuiltInTemplate } from './built-in-templates';
export type { BuiltInTemplate } from './built-in-templates';

// UI components
export { TemplatePicker } from './TemplatePicker';
export { TemplateManager } from './TemplateManager';
export { TemplatePreview } from './TemplatePreview';
