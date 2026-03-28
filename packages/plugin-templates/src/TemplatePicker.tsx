/**
 * TemplatePicker component.
 *
 * Modal dialog for selecting a template when creating a new note.
 * Features:
 * - Search bar to filter templates by name, description, or tag.
 * - Left panel: scrollable template list with category tags.
 * - Right panel: live preview and custom variable input form.
 * - Apply / Cancel actions.
 *
 * The component is controlled entirely by the Zustand template store.
 * The host application is responsible for calling store.openPicker() with
 * an appropriate PickerContext, including the onApply callback.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useTemplateStore } from './template-store';
import { TemplatePreview } from './TemplatePreview';
import type { TemplateEntry } from './template-store';
import type { TemplateMeta } from './template-parser';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TemplateListItemProps {
  template: TemplateEntry;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateListItem({ template, isSelected, onSelect }: TemplateListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-selected={isSelected}
      className={[
        'w-full text-left rounded-md px-3 py-2 transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'bg-accent text-accent-foreground font-medium' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm">{template.meta.name}</span>
        {template.isBuiltIn && (
          <span className="shrink-0 rounded text-xs px-1 py-0.5 bg-muted text-muted-foreground">
            built-in
          </span>
        )}
      </div>
      {template.meta.description && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.meta.description}</p>
      )}
      {template.meta.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {template.meta.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface VariableFormProps {
  meta: TemplateMeta;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

function VariableForm({ meta, values, onChange }: VariableFormProps) {
  const customVars = meta.variables.filter((v) => v.name !== 'cursor');
  if (customVars.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Template Variables</span>
      {customVars.map((variable) => (
        <div key={variable.name} className="flex flex-col gap-1">
          <label htmlFor={`var-${variable.name}`} className="text-sm text-foreground">
            {variable.name}
            {variable.description && (
              <span className="ml-1 text-xs text-muted-foreground">({variable.description})</span>
            )}
          </label>
          <input
            id={`var-${variable.name}`}
            type="text"
            value={values[variable.name] ?? variable.default}
            onChange={(e) => onChange(variable.name, e.target.value)}
            placeholder={variable.default || `Enter ${variable.name}…`}
            className={[
              'h-8 rounded-md border border-input bg-background px-3 py-1',
              'text-sm ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'placeholder:text-muted-foreground',
            ].join(' ')}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TemplatePickerProps {
  /** Author name forwarded to the preview and render context. */
  author?: string;
}

export function TemplatePicker({ author = '' }: TemplatePickerProps) {
  const store = useTemplateStore();
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredTemplates = store.getFilteredTemplates();
  const selectedTemplate = store.getSelectedTemplate();

  // Focus search on open.
  useEffect(() => {
    if (store.isPickerOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [store.isPickerOpen]);

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;
    const ctx = store.pickerContext;
    ctx?.onApply?.(selectedTemplate.id, store.customVariables);
    store.closePicker();
  }, [selectedTemplate, store]);

  const handleCancel = useCallback(() => {
    store.pickerContext?.onCancel?.();
    store.closePicker();
  }, [store]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleApply();
      }
    },
    [handleApply, handleCancel],
  );

  if (!store.isPickerOpen) return null;

  const noteTitle = store.pickerContext?.noteTitle ?? '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a template"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 flex h-[600px] w-[900px] max-w-[95vw] max-h-[90vh] overflow-hidden rounded-lg border bg-background shadow-lg">
        {/* Left: template list */}
        <div className="flex w-64 shrink-0 flex-col border-r">
          {/* Search */}
          <div className="p-3 border-b">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search templates…"
              value={store.pickerSearchQuery}
              onChange={(e) => store.setPickerSearchQuery(e.target.value)}
              aria-label="Search templates"
              className={[
                'h-8 w-full rounded-md border border-input bg-background px-3 py-1',
                'text-sm ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'placeholder:text-muted-foreground',
              ].join(' ')}
            />
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredTemplates.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No templates match your search.
              </p>
            ) : (
              <div className="flex flex-col gap-1" role="listbox" aria-label="Templates">
                {filteredTemplates.map((t) => (
                  <TemplateListItem
                    key={t.id}
                    template={t}
                    isSelected={t.id === store.selectedTemplateId}
                    onSelect={() => store.selectTemplate(t.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Template count */}
          <div className="border-t p-2">
            <p className="text-xs text-muted-foreground text-center">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Right: preview + variables */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">
              {selectedTemplate ? selectedTemplate.meta.name : 'Choose a Template'}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close template picker"
              className="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>

          {selectedTemplate ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {selectedTemplate.meta.description && (
                <p className="text-sm text-muted-foreground">{selectedTemplate.meta.description}</p>
              )}

              {/* Variable inputs */}
              <VariableForm
                meta={selectedTemplate.meta}
                values={store.customVariables}
                onChange={store.setCustomVariable.bind(store)}
              />

              {/* Preview */}
              <TemplatePreview
                template={selectedTemplate}
                variables={store.customVariables}
                author={author}
                noteTitle={noteTitle}
                className="flex-1"
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a template from the list to see a preview.
              </p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="rounded border px-1 font-mono text-xs">Ctrl+Enter</kbd> to apply
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className={[
                  'inline-flex h-8 items-center justify-center rounded-md px-3',
                  'border border-input bg-background text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ].join(' ')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!selectedTemplate}
                aria-disabled={!selectedTemplate}
                className={[
                  'inline-flex h-8 items-center justify-center rounded-md px-4',
                  'bg-primary text-primary-foreground text-sm font-medium',
                  'hover:bg-primary/90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50',
                ].join(' ')}
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
