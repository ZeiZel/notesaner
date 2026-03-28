/**
 * TemplateManager component.
 *
 * CRUD dialog for managing user-created templates.
 * Features:
 * - List of all templates with built-in badge.
 * - Create new template (opens inline editor form).
 * - Edit existing user template (opens inline editor form).
 * - Delete user template with confirmation.
 * - Import template from clipboard / text input.
 * - Export template as markdown text.
 *
 * Built-in templates are shown in a read-only state (no edit/delete actions).
 */

import { useState, useCallback } from 'react';
import { useTemplateStore } from './template-store';
import type { TemplateEntry } from './template-store';
import type { TemplateMeta, TemplateVariableMeta } from './template-parser';
import { serializeTemplate, parseTemplateFile } from './template-parser';

// ---------------------------------------------------------------------------
// Template editor form
// ---------------------------------------------------------------------------

interface EditorFormValues {
  name: string;
  description: string;
  trigger: string;
  folderDefault: string;
  tags: string;
  body: string;
  variables: TemplateVariableMeta[];
}

function toFormValues(entry: TemplateEntry): EditorFormValues {
  return {
    name: entry.meta.name,
    description: entry.meta.description,
    trigger: entry.meta.trigger ?? '',
    folderDefault: entry.meta.folderDefault ?? '',
    tags: entry.meta.tags.join(', '),
    body: entry.body,
    variables: entry.meta.variables.map((v) => ({ ...v })),
  };
}

function fromFormValues(values: EditorFormValues): { meta: TemplateMeta; body: string } {
  return {
    meta: {
      name: values.name.trim(),
      description: values.description.trim(),
      trigger: values.trigger.trim() || undefined,
      folderDefault: values.folderDefault.trim() || undefined,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      variables: values.variables,
    },
    body: values.body,
  };
}

interface TemplateEditorFormProps {
  initial: EditorFormValues;
  onSave: (values: EditorFormValues) => void;
  onCancel: () => void;
}

function TemplateEditorForm({ initial, onSave, onCancel }: TemplateEditorFormProps) {
  const [values, setValues] = useState<EditorFormValues>(initial);

  const updateField = <K extends keyof EditorFormValues>(key: K, value: EditorFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const addVariable = () => {
    setValues((prev) => ({
      ...prev,
      variables: [...prev.variables, { name: '', description: '', default: '' }],
    }));
  };

  const removeVariable = (index: number) => {
    setValues((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
  };

  const updateVariable = (index: number, patch: Partial<TemplateVariableMeta>) => {
    setValues((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const inputCls = [
    'h-8 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm ring-offset-background placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  ].join(' ');

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="tpl-name" className="text-sm font-medium">
          Name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <input
          id="tpl-name"
          type="text"
          value={values.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="My Template"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tpl-desc" className="text-sm font-medium">
          Description
        </label>
        <input
          id="tpl-desc"
          type="text"
          value={values.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="What is this template for?"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-trigger" className="text-sm font-medium">
            Trigger <span className="text-xs text-muted-foreground">(e.g. /daily)</span>
          </label>
          <input
            id="tpl-trigger"
            type="text"
            value={values.trigger}
            onChange={(e) => updateField('trigger', e.target.value)}
            placeholder="/my-trigger"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-folder" className="text-sm font-medium">
            Default Folder
          </label>
          <input
            id="tpl-folder"
            type="text"
            value={values.folderDefault}
            onChange={(e) => updateField('folderDefault', e.target.value)}
            placeholder="Daily Notes"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tpl-tags" className="text-sm font-medium">
          Tags <span className="text-xs text-muted-foreground">(comma-separated)</span>
        </label>
        <input
          id="tpl-tags"
          type="text"
          value={values.tags}
          onChange={(e) => updateField('tags', e.target.value)}
          placeholder="journal, daily"
          className={inputCls}
        />
      </div>

      {/* Custom variables */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Custom Variables</span>
          <button
            type="button"
            onClick={addVariable}
            className="text-xs text-primary hover:underline focus-visible:outline-none"
          >
            + Add variable
          </button>
        </div>
        {values.variables.map((v, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-start">
            <input
              type="text"
              value={v.name}
              onChange={(e) => updateVariable(i, { name: e.target.value })}
              placeholder="variable_name"
              aria-label={`Variable ${i + 1} name`}
              className={inputCls}
            />
            <input
              type="text"
              value={v.description}
              onChange={(e) => updateVariable(i, { description: e.target.value })}
              placeholder="Description"
              aria-label={`Variable ${i + 1} description`}
              className={inputCls}
            />
            <div className="flex gap-1">
              <input
                type="text"
                value={v.default}
                onChange={(e) => updateVariable(i, { default: e.target.value })}
                placeholder="Default"
                aria-label={`Variable ${i + 1} default`}
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeVariable(i)}
                aria-label={`Remove variable ${v.name || i + 1}`}
                className="shrink-0 text-muted-foreground hover:text-destructive focus-visible:outline-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Body editor */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tpl-body" className="text-sm font-medium">
          Template Content
        </label>
        <textarea
          id="tpl-body"
          value={values.body}
          onChange={(e) => updateField('body', e.target.value)}
          placeholder="# {{title}}&#10;&#10;{{cursor}}"
          rows={12}
          className={[
            'w-full rounded-md border border-input bg-background px-3 py-2',
            'font-mono text-sm ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'resize-y',
          ].join(' ')}
        />
        <p className="text-xs text-muted-foreground">
          Use <code className="rounded bg-muted px-1">{'{{variable}}'}</code> for variable tokens.
          Use <code className="rounded bg-muted px-1">{'{{cursor}}'}</code> to set initial cursor
          position.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
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
          onClick={() => onSave(values)}
          disabled={!values.name.trim()}
          className={[
            'inline-flex h-8 items-center justify-center rounded-md px-4',
            'bg-primary text-primary-foreground text-sm font-medium',
            'hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          ].join(' ')}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TemplateManagerProps {
  /** Callback when the manager should be closed. */
  onClose?: () => void;
}

type ManagerMode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; templateId: string }
  | { kind: 'confirm-delete'; templateId: string };

export function TemplateManager({ onClose }: TemplateManagerProps) {
  const store = useTemplateStore();
  const [mode, setMode] = useState<ManagerMode>({ kind: 'list' });
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleClose = useCallback(() => {
    store.closeManager();
    onClose?.();
  }, [store, onClose]);

  const handleCreate = useCallback(
    (values: EditorFormValues) => {
      const { meta, body } = fromFormValues(values);
      const id = `user:${meta.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      store.addTemplate({ id, meta, body });
      setMode({ kind: 'list' });
    },
    [store],
  );

  const handleEdit = useCallback(
    (id: string, values: EditorFormValues) => {
      const { meta, body } = fromFormValues(values);
      store.updateTemplate(id, { meta, body });
      setMode({ kind: 'list' });
    },
    [store],
  );

  const handleDelete = useCallback(
    (id: string) => {
      store.removeTemplate(id);
      setMode({ kind: 'list' });
    },
    [store],
  );

  const handleExport = useCallback((template: TemplateEntry) => {
    const text = serializeTemplate(template.meta, template.body);
    navigator.clipboard.writeText(text).catch(() => {
      // Clipboard not available — silently ignore.
    });
  }, []);

  const handleImport = useCallback(() => {
    if (!importText.trim()) return;
    const parsed = parseTemplateFile(importText);
    const id = `user:imported-${Date.now()}`;
    store.addTemplate({ id, meta: parsed.meta, body: parsed.body });
    setImportText('');
    setShowImport(false);
  }, [importText, store]);

  const BLANK_FORM: EditorFormValues = {
    name: '',
    description: '',
    trigger: '',
    folderDefault: '',
    tags: '',
    body: '# {{title}}\n\n{{cursor}}',
    variables: [],
  };

  if (!store.isManagerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Template manager"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 flex h-[640px] w-[820px] max-w-[95vw] max-h-[90vh] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Template Manager</h2>
          <div className="flex items-center gap-2">
            {mode.kind === 'list' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowImport((v) => !v)}
                  className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none"
                >
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => setMode({ kind: 'create' })}
                  className={[
                    'inline-flex h-7 items-center justify-center rounded-md px-3',
                    'bg-primary text-primary-foreground text-xs font-medium',
                    'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ].join(' ')}
                >
                  New Template
                </button>
              </>
            )}
            {mode.kind !== 'list' && (
              <button
                type="button"
                onClick={() => setMode({ kind: 'list' })}
                className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none"
              >
                Back to list
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close manager"
              className="opacity-70 hover:opacity-100 focus-visible:outline-none"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                ×
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode.kind === 'list' && (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Import area */}
              {showImport && (
                <div className="border-b p-4 flex flex-col gap-2">
                  <span className="text-sm font-medium">Import Template</span>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste template markdown here (with or without frontmatter)…"
                    rows={5}
                    className={[
                      'w-full rounded-md border border-input bg-background px-3 py-2',
                      'font-mono text-sm placeholder:text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={!importText.trim()}
                      className={[
                        'inline-flex h-7 items-center justify-center rounded-md px-3',
                        'bg-primary text-primary-foreground text-xs',
                        'hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      ].join(' ')}
                    >
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowImport(false);
                        setImportText('');
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Template list */}
              <div className="flex-1 p-4">
                <div className="flex flex-col gap-2">
                  {store.templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{t.meta.name}</span>
                          {t.isBuiltIn && (
                            <span className="shrink-0 rounded text-xs px-1 py-0.5 bg-muted text-muted-foreground">
                              built-in
                            </span>
                          )}
                          {t.meta.trigger && (
                            <span className="shrink-0 rounded font-mono text-xs px-1 py-0.5 bg-secondary text-secondary-foreground">
                              {t.meta.trigger}
                            </span>
                          )}
                        </div>
                        {t.meta.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {t.meta.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExport(t)}
                          title="Copy to clipboard"
                          className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none"
                        >
                          Export
                        </button>
                        {!t.isBuiltIn && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMode({ kind: 'edit', templateId: t.id })}
                              className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setMode({ kind: 'confirm-delete', templateId: t.id })}
                              className="text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode.kind === 'create' && (
            <TemplateEditorForm
              initial={BLANK_FORM}
              onSave={handleCreate}
              onCancel={() => setMode({ kind: 'list' })}
            />
          )}

          {mode.kind === 'edit' &&
            (() => {
              const entry = store.templates.find((t) => t.id === mode.templateId);
              if (!entry) return null;
              return (
                <TemplateEditorForm
                  initial={toFormValues(entry)}
                  onSave={(values) => handleEdit(mode.templateId, values)}
                  onCancel={() => setMode({ kind: 'list' })}
                />
              );
            })()}

          {mode.kind === 'confirm-delete' &&
            (() => {
              const entry = store.templates.find((t) => t.id === mode.templateId);
              return (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="flex flex-col gap-4 text-center max-w-sm">
                    <p className="text-sm">
                      Are you sure you want to delete{' '}
                      <strong>{entry?.meta.name ?? 'this template'}</strong>? This action cannot be
                      undone.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setMode({ kind: 'list' })}
                        className={[
                          'inline-flex h-8 items-center justify-center rounded-md px-3',
                          'border border-input bg-background text-sm',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        ].join(' ')}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(mode.templateId)}
                        className={[
                          'inline-flex h-8 items-center justify-center rounded-md px-3',
                          'bg-destructive text-destructive-foreground text-sm',
                          'hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        ].join(' ')}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
