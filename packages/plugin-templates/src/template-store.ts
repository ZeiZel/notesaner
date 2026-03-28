/**
 * Zustand store for the templates plugin state.
 *
 * Responsibilities:
 * - Hold the list of all templates (built-in + user-created).
 * - Track the currently selected template in the picker.
 * - Manage custom variable values entered by the user.
 * - Control picker / manager dialog open states.
 * - Store per-folder default template configuration.
 *
 * This store does NOT talk to the filesystem directly. Persistence and
 * template loading is delegated to the host application. The store exposes
 * actions that the host calls after operations complete.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TemplateMeta } from './template-parser';
import type { BuiltInTemplate } from './built-in-templates';
import { BUILT_IN_TEMPLATES } from './built-in-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A template entry in the store (built-in or user-created). */
export interface TemplateEntry {
  /** Unique identifier. Built-in IDs start with 'built-in:'. */
  id: string;
  /** Template metadata. */
  meta: TemplateMeta;
  /** Template body content (without frontmatter). */
  body: string;
  /**
   * True for templates that ship with the plugin.
   * Built-in templates cannot be deleted via the store.
   */
  isBuiltIn: boolean;
  /**
   * Optional file path in the workspace's templates folder.
   * Undefined for built-in templates and unsaved user templates.
   */
  filePath?: string;
}

/** Custom variable values collected from the user before applying a template. */
export type CustomVariableValues = Record<string, string>;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface TemplateState {
  /** All available templates (built-in + user). */
  templates: TemplateEntry[];

  /** ID of the currently selected template in the picker. Null when none. */
  selectedTemplateId: string | null;

  /**
   * Custom variable values being filled in for the selected template.
   * Keyed by variable name.
   */
  customVariables: CustomVariableValues;

  /**
   * Map of workspace folder path → template ID.
   * When a note is created in a folder that has a default template, the
   * picker pre-selects that template.
   */
  defaultTemplateByFolder: Record<string, string>;

  /** Whether the template picker dialog is open. */
  isPickerOpen: boolean;

  /** Whether the template manager dialog is open. */
  isManagerOpen: boolean;

  /** Whether the template settings panel is open. */
  isSettingsOpen: boolean;

  /**
   * Search query in the template picker.
   * Filtered templates are derived from this value.
   */
  pickerSearchQuery: string;

  /**
   * Context passed when the picker was opened.
   * Used to pre-fill {{title}} and folder-based default selection.
   */
  pickerContext: PickerContext | null;

  /** Whether templates are being loaded (e.g. from the filesystem). */
  isLoading: boolean;

  /** Error message, if any. Null when no error. */
  error: string | null;
}

/** Context passed when opening the template picker. */
export interface PickerContext {
  /** The note title that will be created. */
  noteTitle?: string;
  /** The folder in which the note will be created. */
  folderPath?: string;
  /** Callback invoked when the user confirms template selection. */
  onApply?: (templateId: string, variables: CustomVariableValues) => void;
  /** Callback invoked when the user cancels the picker. */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Actions shape
// ---------------------------------------------------------------------------

export interface TemplateActions {
  // --- Template CRUD ---

  /**
   * Adds a user-created template to the store.
   * If a template with the same ID already exists, it is replaced.
   */
  addTemplate(entry: Omit<TemplateEntry, 'isBuiltIn'>): void;

  /**
   * Updates an existing user-created template.
   * No-op for built-in templates.
   */
  updateTemplate(
    id: string,
    patch: Partial<Pick<TemplateEntry, 'meta' | 'body' | 'filePath'>>,
  ): void;

  /**
   * Removes a user-created template.
   * No-op for built-in templates (they cannot be deleted from store).
   */
  removeTemplate(id: string): void;

  /**
   * Replaces all user-created templates (e.g. after scanning the templates folder).
   * Built-in templates are preserved.
   */
  setUserTemplates(entries: Array<Omit<TemplateEntry, 'isBuiltIn'>>): void;

  // --- Picker control ---

  /** Opens the template picker with the given context. */
  openPicker(context?: PickerContext): void;

  /** Closes the template picker and resets transient state. */
  closePicker(): void;

  /** Sets the selected template ID in the picker. */
  selectTemplate(id: string | null): void;

  /** Updates a single custom variable value. */
  setCustomVariable(name: string, value: string): void;

  /** Replaces all custom variable values at once. */
  setCustomVariables(values: CustomVariableValues): void;

  /** Clears all custom variable values. */
  clearCustomVariables(): void;

  /** Updates the picker search query. */
  setPickerSearchQuery(query: string): void;

  // --- Manager / Settings dialogs ---

  openManager(): void;
  closeManager(): void;
  openSettings(): void;
  closeSettings(): void;

  // --- Folder defaults ---

  /** Sets the default template for a workspace folder. */
  setFolderDefault(folderPath: string, templateId: string): void;

  /** Removes the default template assignment for a folder. */
  clearFolderDefault(folderPath: string): void;

  /**
   * Returns the template ID that is the default for the given folder,
   * walking up the path hierarchy to find the closest match.
   */
  getFolderDefault(folderPath: string): string | null;

  // --- Loading state ---

  setLoading(loading: boolean): void;
  setError(error: string | null): void;

  // --- Derived helpers ---

  /**
   * Returns the filtered list of templates matching the picker search query.
   * Empty query returns all templates.
   */
  getFilteredTemplates(): TemplateEntry[];

  /**
   * Returns the currently selected TemplateEntry, or null.
   */
  getSelectedTemplate(): TemplateEntry | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function builtInToEntry(t: BuiltInTemplate): TemplateEntry {
  return {
    id: t.id,
    meta: t.meta,
    body: t.body,
    isBuiltIn: true,
  };
}

const INITIAL_TEMPLATES: TemplateEntry[] = BUILT_IN_TEMPLATES.map(builtInToEntry);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTemplateStore = create<TemplateState & TemplateActions>()(
  devtools(
    (set, get) => ({
      // -----------------------------------------------------------------------
      // Initial state
      // -----------------------------------------------------------------------
      templates: INITIAL_TEMPLATES,
      selectedTemplateId: null,
      customVariables: {},
      defaultTemplateByFolder: {},
      isPickerOpen: false,
      isManagerOpen: false,
      isSettingsOpen: false,
      pickerSearchQuery: '',
      pickerContext: null,
      isLoading: false,
      error: null,

      // -----------------------------------------------------------------------
      // Template CRUD
      // -----------------------------------------------------------------------

      addTemplate(entry) {
        set(
          (state) => {
            const existing = state.templates.find((t) => t.id === entry.id);
            if (existing) {
              return {
                templates: state.templates.map((t) =>
                  t.id === entry.id ? { ...entry, isBuiltIn: false } : t,
                ),
              };
            }
            return {
              templates: [...state.templates, { ...entry, isBuiltIn: false }],
            };
          },
          false,
          'addTemplate',
        );
      },

      updateTemplate(id, patch) {
        set(
          (state) => ({
            templates: state.templates.map((t) => {
              if (t.id !== id || t.isBuiltIn) return t;
              return { ...t, ...patch };
            }),
          }),
          false,
          'updateTemplate',
        );
      },

      removeTemplate(id) {
        set(
          (state) => ({
            templates: state.templates.filter((t) => (t.id === id ? !t.isBuiltIn : true)),
          }),
          false,
          'removeTemplate',
        );
      },

      setUserTemplates(entries) {
        set(
          (state) => {
            const builtIns = state.templates.filter((t) => t.isBuiltIn);
            const userEntries = entries.map((e) => ({ ...e, isBuiltIn: false as const }));
            return { templates: [...builtIns, ...userEntries] };
          },
          false,
          'setUserTemplates',
        );
      },

      // -----------------------------------------------------------------------
      // Picker control
      // -----------------------------------------------------------------------

      openPicker(context) {
        const state = get();
        // Auto-select based on folder default when a folder is provided.
        let autoSelectId: string | null = null;
        if (context?.folderPath) {
          autoSelectId = state.getFolderDefault(context.folderPath);
        }
        set(
          {
            isPickerOpen: true,
            pickerContext: context ?? null,
            pickerSearchQuery: '',
            selectedTemplateId: autoSelectId,
            customVariables: {},
          },
          false,
          'openPicker',
        );
      },

      closePicker() {
        set(
          {
            isPickerOpen: false,
            pickerContext: null,
            pickerSearchQuery: '',
            selectedTemplateId: null,
            customVariables: {},
          },
          false,
          'closePicker',
        );
      },

      selectTemplate(id) {
        set({ selectedTemplateId: id, customVariables: {} }, false, 'selectTemplate');
      },

      setCustomVariable(name, value) {
        set(
          (state) => ({
            customVariables: { ...state.customVariables, [name]: value },
          }),
          false,
          'setCustomVariable',
        );
      },

      setCustomVariables(values) {
        set({ customVariables: values }, false, 'setCustomVariables');
      },

      clearCustomVariables() {
        set({ customVariables: {} }, false, 'clearCustomVariables');
      },

      setPickerSearchQuery(query) {
        set({ pickerSearchQuery: query }, false, 'setPickerSearchQuery');
      },

      // -----------------------------------------------------------------------
      // Manager / Settings dialogs
      // -----------------------------------------------------------------------

      openManager() {
        set({ isManagerOpen: true }, false, 'openManager');
      },

      closeManager() {
        set({ isManagerOpen: false }, false, 'closeManager');
      },

      openSettings() {
        set({ isSettingsOpen: true }, false, 'openSettings');
      },

      closeSettings() {
        set({ isSettingsOpen: false }, false, 'closeSettings');
      },

      // -----------------------------------------------------------------------
      // Folder defaults
      // -----------------------------------------------------------------------

      setFolderDefault(folderPath, templateId) {
        set(
          (state) => ({
            defaultTemplateByFolder: {
              ...state.defaultTemplateByFolder,
              [folderPath]: templateId,
            },
          }),
          false,
          'setFolderDefault',
        );
      },

      clearFolderDefault(folderPath) {
        set(
          (state) => {
            const next = { ...state.defaultTemplateByFolder };
            delete next[folderPath];
            return { defaultTemplateByFolder: next };
          },
          false,
          'clearFolderDefault',
        );
      },

      getFolderDefault(folderPath) {
        const { defaultTemplateByFolder } = get();

        // Normalise path separators.
        const normalise = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '');
        let path = normalise(folderPath);

        // Walk up the hierarchy.
        while (path.length > 0) {
          const match = defaultTemplateByFolder[path];
          if (match !== undefined) return match;
          const parentIdx = path.lastIndexOf('/');
          if (parentIdx === -1) break;
          path = path.slice(0, parentIdx);
        }

        return null;
      },

      // -----------------------------------------------------------------------
      // Loading state
      // -----------------------------------------------------------------------

      setLoading(loading) {
        set({ isLoading: loading }, false, 'setLoading');
      },

      setError(error) {
        set({ error }, false, 'setError');
      },

      // -----------------------------------------------------------------------
      // Derived helpers
      // -----------------------------------------------------------------------

      getFilteredTemplates() {
        const { templates, pickerSearchQuery } = get();
        if (!pickerSearchQuery.trim()) return templates;
        const q = pickerSearchQuery.toLowerCase();
        return templates.filter(
          (t) =>
            t.meta.name.toLowerCase().includes(q) ||
            t.meta.description.toLowerCase().includes(q) ||
            t.meta.tags.some((tag) => tag.toLowerCase().includes(q)),
        );
      },

      getSelectedTemplate() {
        const { templates, selectedTemplateId } = get();
        if (!selectedTemplateId) return null;
        return templates.find((t) => t.id === selectedTemplateId) ?? null;
      },
    }),
    { name: 'template-store' },
  ),
);
