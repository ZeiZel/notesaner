/**
 * TemplateSettings component.
 *
 * Settings panel for the templates plugin.
 * Features:
 * - Configure the templates folder location within the workspace.
 * - Set a default template per workspace folder.
 * - Clear individual folder defaults.
 *
 * This component is typically rendered inside the host application's settings
 * panel rather than as a modal dialog.
 */

import { useState, useCallback } from 'react';
import { useTemplateStore } from './template-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateSettingsProps {
  /**
   * Current templates folder path relative to workspace root.
   * Controlled by the host application.
   */
  templatesFolder: string;
  /**
   * Called when the user changes the templates folder path.
   */
  onTemplatesFolderChange: (folder: string) => void;
  /**
   * Available workspace folders for the folder default selector.
   * If not provided, the user must type the path manually.
   */
  workspaceFolders?: string[];
}

// ---------------------------------------------------------------------------
// FolderDefaultRow sub-component
// ---------------------------------------------------------------------------

interface FolderDefaultRowProps {
  folderPath: string;
  templateId: string;
  templateName: string;
  onClear: () => void;
}

function FolderDefaultRow({
  folderPath,
  templateId: _templateId,
  templateName,
  onClear,
}: FolderDefaultRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-mono truncate">{folderPath || '/'}</span>
        <span className="text-xs text-muted-foreground truncate">{templateName}</span>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove default for ${folderPath}`}
        className="ml-4 shrink-0 text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none"
      >
        Remove
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddFolderDefaultForm sub-component
// ---------------------------------------------------------------------------

interface AddFolderDefaultFormProps {
  templates: Array<{ id: string; name: string }>;
  workspaceFolders?: string[];
  onAdd: (folderPath: string, templateId: string) => void;
  onCancel: () => void;
}

function AddFolderDefaultForm({
  templates,
  workspaceFolders,
  onAdd,
  onCancel,
}: AddFolderDefaultFormProps) {
  const [folderPath, setFolderPath] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');

  const inputCls = [
    'h-8 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm ring-offset-background placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  ].join(' ');

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="add-folder-path" className="text-sm font-medium">
          Folder Path
        </label>
        {workspaceFolders && workspaceFolders.length > 0 ? (
          <select
            id="add-folder-path"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a folder…</option>
            {workspaceFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="add-folder-path"
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Daily Notes"
            className={inputCls}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="add-template-id" className="text-sm font-medium">
          Default Template
        </label>
        <select
          id="add-template-id"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={inputCls}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (folderPath.trim() && templateId) {
              onAdd(folderPath.trim(), templateId);
            }
          }}
          disabled={!folderPath.trim() || !templateId}
          className={[
            'inline-flex h-7 items-center justify-center rounded-md px-3',
            'bg-primary text-primary-foreground text-xs',
            'hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ].join(' ')}
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TemplateSettings({
  templatesFolder,
  onTemplatesFolderChange,
  workspaceFolders,
}: TemplateSettingsProps) {
  const store = useTemplateStore();
  const [showAddRow, setShowAddRow] = useState(false);
  const [folderInput, setFolderInput] = useState(templatesFolder);

  const templateOptions = store.templates.map((t) => ({ id: t.id, name: t.meta.name }));

  const handleFolderSave = useCallback(() => {
    onTemplatesFolderChange(folderInput.trim());
  }, [folderInput, onTemplatesFolderChange]);

  const handleAddDefault = useCallback(
    (folderPath: string, templateId: string) => {
      store.setFolderDefault(folderPath, templateId);
      setShowAddRow(false);
    },
    [store],
  );

  const folderDefaults = Object.entries(store.defaultTemplateByFolder);

  const inputCls = [
    'h-8 flex-1 rounded-md border border-input bg-background px-3 py-1',
    'text-sm ring-offset-background placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  ].join(' ');

  return (
    <div className="flex flex-col gap-6 p-4">
      <h3 className="text-base font-semibold">Template Settings</h3>

      {/* Templates folder */}
      <section className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-medium">Templates Folder</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Folder where your custom template files are stored (relative to workspace root).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder="Templates"
            aria-label="Templates folder path"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleFolderSave}
            disabled={folderInput.trim() === templatesFolder}
            className={[
              'inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3',
              'bg-primary text-primary-foreground text-sm',
              'hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            ].join(' ')}
          >
            Save
          </button>
        </div>
      </section>

      {/* Default templates per folder */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Default Template per Folder</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              When creating a note in a folder, automatically pre-select a template.
            </p>
          </div>
          {!showAddRow && (
            <button
              type="button"
              onClick={() => setShowAddRow(true)}
              className="text-xs text-primary hover:underline focus-visible:outline-none"
            >
              + Add
            </button>
          )}
        </div>

        {showAddRow && (
          <AddFolderDefaultForm
            templates={templateOptions}
            workspaceFolders={workspaceFolders}
            onAdd={handleAddDefault}
            onCancel={() => setShowAddRow(false)}
          />
        )}

        {folderDefaults.length === 0 && !showAddRow ? (
          <p className="text-xs text-muted-foreground">No folder defaults configured.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {folderDefaults.map(([folderPath, templateId]) => {
              const tpl = store.templates.find((t) => t.id === templateId);
              return (
                <FolderDefaultRow
                  key={folderPath}
                  folderPath={folderPath}
                  templateId={templateId}
                  templateName={tpl?.meta.name ?? templateId}
                  onClear={() => store.clearFolderDefault(folderPath)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
