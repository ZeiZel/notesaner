'use client';

import { useRef, useEffect, useState } from 'react';
import { useLayoutStore } from '@/shared/stores/layout-store';
import { useGridLayoutStore, GRID_PRESETS } from '../model/grid-layout-store';
import type { SnapTemplate, SavedLayout, SnapTemplateId } from '../model/snap-layout-types';
import { SNAP_TEMPLATES } from '../model/snap-layout-types';

// ---------------------------------------------------------------------------
// LayoutTemplatePreview
// ---------------------------------------------------------------------------

interface LayoutTemplatePreviewProps {
  template: SnapTemplate;
  isActive: boolean;
  onClick: () => void;
}

function LayoutTemplatePreview({ template, isActive, onClick }: LayoutTemplatePreviewProps) {
  return (
    <button
      type="button"
      aria-label={`Apply ${template.label} layout`}
      aria-pressed={isActive}
      onClick={onClick}
      className={[
        'group relative flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors',
        'hover:bg-background-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isActive ? 'bg-primary-muted ring-1 ring-primary' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Mini grid preview */}
      <div
        className="h-10 w-16 overflow-hidden rounded-sm border border-border bg-background-surface"
        style={{
          display: 'grid',
          gridTemplateColumns: template.gridCols,
          gridTemplateRows: template.gridRows,
          gap: '2px',
          padding: '2px',
        }}
      >
        {template.panels.map((panel) => (
          <div
            key={panel.id}
            className={[
              'rounded-[2px] transition-colors',
              isActive
                ? 'bg-primary/40 group-hover:bg-primary/60'
                : 'bg-foreground-muted/25 group-hover:bg-primary/30',
            ].join(' ')}
            style={{
              gridColumn: `${panel.colStart} / ${panel.colEnd}`,
              gridRow: `${panel.rowStart} / ${panel.rowEnd}`,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span
        className={[
          'text-[11px] font-medium leading-none',
          isActive ? 'text-primary' : 'text-foreground-muted',
        ].join(' ')}
      >
        {template.label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SaveLayoutDialog (inline — no external dependency)
// ---------------------------------------------------------------------------

interface SaveLayoutDialogProps {
  onSave: (name: string) => void;
  onCancel: () => void;
}

function SaveLayoutDialog({ onSave, onCancel }: SaveLayoutDialogProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-3">
      <label htmlFor="layout-name-input" className="text-xs font-medium text-foreground-secondary">
        Layout name
      </label>
      <input
        id="layout-name-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Writing setup"
        autoFocus
        className="w-full rounded-md border border-border bg-background-input px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary-hover"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SavedLayoutItem
// ---------------------------------------------------------------------------

interface SavedLayoutItemProps {
  layout: SavedLayout;
  onLoad: () => void;
  onDelete: () => void;
}

function SavedLayoutItem({ layout, onLoad, onDelete }: SavedLayoutItemProps) {
  const template = SNAP_TEMPLATES.find((t) => t.id === layout.templateId);

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-background-hover">
      {/* Mini thumbnail */}
      {template && (
        <div
          className="h-5 w-8 shrink-0 overflow-hidden rounded-[2px] border border-border bg-background-surface"
          style={{
            display: 'grid',
            gridTemplateColumns: template.gridCols,
            gridTemplateRows: template.gridRows,
            gap: '1px',
            padding: '1px',
          }}
        >
          {template.panels.map((panel) => (
            <div
              key={panel.id}
              className="rounded-[1px] bg-foreground-muted/30"
              style={{
                gridColumn: `${panel.colStart} / ${panel.colEnd}`,
                gridRow: `${panel.rowStart} / ${panel.rowEnd}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Name — clickable to load */}
      <button
        type="button"
        onClick={onLoad}
        className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-primary"
      >
        {layout.name}
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${layout.name}`}
        className="hidden shrink-0 rounded p-0.5 text-foreground-muted transition-colors hover:bg-destructive/15 hover:text-destructive group-hover:flex"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnapLayoutPicker (main component)
// ---------------------------------------------------------------------------

export interface SnapLayoutPickerProps {
  /**
   * Anchor position. When provided the picker floats near the anchor point,
   * which is used for the drag-near-edge trigger. When omitted the picker
   * renders as a floating panel centred on screen (keyboard trigger).
   */
  anchorX?: number;
  anchorY?: number;
}

export function SnapLayoutPicker({ anchorX, anchorY }: SnapLayoutPickerProps) {
  const isOpen = useLayoutStore((s) => s.isSnapPickerOpen);
  const setOpen = useLayoutStore((s) => s.setSnapPickerOpen);
  const applyTemplate = useLayoutStore((s) => s.applySnapTemplate);
  const currentTemplateId = useLayoutStore((s) => s.currentLayout.snapTemplateId ?? 'single');
  const savedLayouts = useLayoutStore((s) => s.savedLayouts);
  const saveCurrentLayout = useLayoutStore((s) => s.saveCurrentLayout);
  const loadSavedLayout = useLayoutStore((s) => s.loadSavedLayout);
  const deleteSavedLayout = useLayoutStore((s) => s.deleteSavedLayout);

  // Grid layout store integration
  const applyGridPreset = useGridLayoutStore((s) => s.applyPreset);
  const setGridConfig = useGridLayoutStore((s) => s.setGridConfig);

  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    // Use capture so this fires before any stopPropagation inside the picker
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  // Determine position
  const positionStyle: React.CSSProperties =
    anchorX !== undefined && anchorY !== undefined
      ? {
          position: 'fixed',
          left: `${anchorX}px`,
          top: `${anchorY}px`,
          transform: 'translate(-50%, 8px)',
        }
      : {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Snap layout picker"
      aria-modal="true"
      style={positionStyle}
      className="z-50 flex w-72 flex-col gap-3 rounded-xl border border-border bg-background-elevated p-3 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Snap Layouts
        </span>
        <kbd className="rounded border border-border bg-background-surface px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted">
          Esc
        </kbd>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-3 gap-1">
        {SNAP_TEMPLATES.map((template) => (
          <LayoutTemplatePreview
            key={template.id}
            template={template}
            isActive={currentTemplateId === template.id}
            onClick={() => {
              // Apply to both stores for full sync
              applyTemplate(template.id as SnapTemplateId);
              // Sync grid layout store with the preset
              const gridPreset = GRID_PRESETS[template.id];
              if (gridPreset) {
                applyGridPreset(template.id);
              } else {
                // For templates without a direct grid preset, build one
                setGridConfig({
                  columns: template.gridCols.split(/\s+/),
                  rows: template.gridRows.split(/\s+/),
                  panes: template.panels.map((tp) => ({
                    id: tp.id,
                    gridArea: tp.id,
                    colStart: tp.colStart,
                    colEnd: tp.colEnd,
                    rowStart: tp.rowStart,
                    rowEnd: tp.rowEnd,
                    focusedNoteId: null,
                  })),
                });
              }
            }}
          />
        ))}
      </div>

      {/* Saved layouts section */}
      {savedLayouts.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-border pt-2">
          <span className="mb-1 text-xs font-medium text-foreground-muted">Saved layouts</span>
          {savedLayouts.map((layout) => (
            <SavedLayoutItem
              key={layout.id}
              layout={layout}
              onLoad={() => {
                loadSavedLayout(layout.id);
                // Sync grid layout store with the saved config
                if (layout.gridConfig) {
                  setGridConfig(layout.gridConfig);
                } else {
                  // Fall back to preset if no grid config saved
                  const gridPreset = GRID_PRESETS[layout.templateId];
                  if (gridPreset) {
                    applyGridPreset(layout.templateId);
                  }
                }
              }}
              onDelete={() => deleteSavedLayout(layout.id)}
            />
          ))}
        </div>
      )}

      {/* Save current layout */}
      {isSaving ? (
        <SaveLayoutDialog
          onSave={(name) => {
            saveCurrentLayout(name);
            setIsSaving(false);
          }}
          onCancel={() => setIsSaving(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsSaving(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs text-foreground-muted transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          Save current layout
        </button>
      )}

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-foreground-muted">
        Open with{' '}
        <kbd className="rounded border border-border bg-background-surface px-1 font-mono">
          Cmd+Shift+L
        </kbd>
      </p>
    </div>
  );
}
