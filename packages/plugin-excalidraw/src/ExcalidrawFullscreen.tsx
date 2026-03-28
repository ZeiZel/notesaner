'use client';

/**
 * ExcalidrawFullscreen — full-screen whiteboard view for a single Excalidraw drawing.
 *
 * Used by the plugin's "view" entry point and by the "Open Fullscreen" button
 * in ExcalidrawEmbed. The host application renders this component when the
 * user opens a drawing in fullscreen mode (e.g. via the standalone whiteboard view).
 *
 * Features:
 * - Full-viewport Excalidraw canvas
 * - Header bar: drawing title, back button, save status, export controls
 * - Links to the associated note (when linkedNoteId is set)
 * - Keyboard shortcut: Escape to close / go back
 * - Auto-save with 1 s debounce
 * - Export PNG / SVG
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useExcalidrawStore,
  serializeDrawing,
  parseExcalidrawFile,
  DEFAULT_APP_STATE,
  type ExcalidrawElement,
  type ExcalidrawAppState,
  type ExcalidrawFileData,
} from './excalidraw-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExcalidrawFullscreenProps {
  /** Path of the .excalidraw file to open. */
  filePath: string;
  /**
   * Optional note ID linked to this drawing.
   * When set, a "Go to note" button is shown.
   */
  linkedNoteId?: string | null;
  /** Called when the user wants to close the fullscreen view. */
  onClose: () => void;
  /**
   * Called when the user clicks "Go to note".
   * Receives the linked note ID.
   */
  onNavigateToNote?: (noteId: string) => void;
  /**
   * Optional plugin storage accessor for loading/saving drawing data.
   * When absent, the drawing starts empty and export-only.
   */
  pluginStorage?: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<void>;
  };
  /**
   * Called when the user exports the drawing.
   * When absent, the browser download fallback is used.
   */
  onExport?: (filePath: string, format: 'png' | 'svg', data: Blob) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------

import type { ExcalidrawProps } from '@excalidraw/excalidraw';

type ExcalidrawComponent = React.ComponentType<ExcalidrawProps>;

const SAVE_DEBOUNCE_MS = 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExcalidrawFullscreen({
  filePath,
  linkedNoteId,
  onClose,
  onNavigateToNote,
  pluginStorage,
  onExport,
}: ExcalidrawFullscreenProps) {
  const drawingState = useExcalidrawStore((s) => s.drawings.get(filePath));
  const { initDrawing, updateDrawing, setSaving, markSaved, setSaveError, removeDrawing } =
    useExcalidrawStore((s) => s.actions);

  const [ExcalidrawComp, setExcalidrawComp] = useState<ExcalidrawComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load Excalidraw lazily
  useEffect(() => {
    let cancelled = false;
    void import('@excalidraw/excalidraw').then((mod) => {
      if (!cancelled) {
        setExcalidrawComp(() => mod.Excalidraw as ExcalidrawComponent);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load drawing data
  useEffect(() => {
    if (drawingState) return;

    async function load() {
      if (pluginStorage) {
        try {
          const raw = await pluginStorage.get(`excalidraw:${filePath}`);
          if (raw) {
            initDrawing(filePath, parseExcalidrawFile(raw));
            return;
          }
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load drawing');
        }
      }

      const emptyData: ExcalidrawFileData = {
        type: 'excalidraw',
        version: 2,
        elements: [],
        appState: DEFAULT_APP_STATE,
        files: {},
      };
      initDrawing(filePath, emptyData);
    }

    void load();

    return () => {
      removeDrawing(filePath);
    };
  }, [filePath]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const saveDrawing = useCallback(async () => {
    if (!drawingState?.isDirty || !pluginStorage) return;

    setSaving(filePath, true);
    try {
      const json = JSON.stringify(serializeDrawing(drawingState), null, 2);
      await pluginStorage.set(`excalidraw:${filePath}`, json);
      markSaved(filePath);
    } catch (err) {
      setSaveError(filePath, err instanceof Error ? err.message : 'Save failed');
    }
  }, [drawingState, filePath, setSaving, markSaved, setSaveError, pluginStorage]);

  // Debounced auto-save
  useEffect(() => {
    if (!drawingState?.isDirty) return;
    const timer = setTimeout(() => void saveDrawing(), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [drawingState?.isDirty, saveDrawing]);

  // ---------------------------------------------------------------------------
  // Change handler
  // ---------------------------------------------------------------------------

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: ExcalidrawAppState,
      files: Record<string, unknown>,
    ) => {
      updateDrawing(filePath, [...elements], appState, files);
    },
    [filePath, updateDrawing],
  );

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async function exportDrawing(format: 'png' | 'svg') {
    if (!drawingState) return;
    try {
      const { exportToBlob, exportToSvg } = await import('@excalidraw/excalidraw');
      const fileName = filePath.split('/').pop()?.replace('.excalidraw', '') ?? 'drawing';

      if (format === 'png') {
        const blob = await exportToBlob({
          elements: drawingState.elements,
          appState: drawingState.appState,
          files: drawingState.files,
          mimeType: 'image/png',
        });

        if (onExport) {
          await onExport(filePath, 'png', blob);
        } else {
          triggerDownload(blob, `${fileName}.png`);
        }
      } else {
        const svgEl = await exportToSvg({
          elements: drawingState.elements,
          appState: drawingState.appState,
          files: drawingState.files,
        });

        const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], {
          type: 'image/svg+xml',
        });

        if (onExport) {
          await onExport(filePath, 'svg', blob);
        } else {
          triggerDownload(blob, `${fileName}.svg`);
        }
      }
    } catch (err) {
      setSaveError(
        filePath,
        err instanceof Error ? err.message : `${format.toUpperCase()} export failed`,
      );
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Status text
  // ---------------------------------------------------------------------------

  const statusText = useMemo(() => {
    if (!drawingState) return 'Loading…';
    if (loadError) return `Error: ${loadError}`;
    if (drawingState.isSaving) return 'Saving…';
    if (drawingState.saveError) return `Save failed: ${drawingState.saveError}`;
    if (drawingState.isDirty) return 'Unsaved changes';
    if (drawingState.lastSaved) {
      return `Saved at ${new Date(drawingState.lastSaved).toLocaleTimeString()}`;
    }
    return 'New drawing';
  }, [drawingState, loadError]);

  const drawingTitle = filePath.split('/').pop()?.replace('.excalidraw', '') ?? 'Whiteboard';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Excalidraw whiteboard: ${drawingTitle}`}
    >
      {/* Header bar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2">
        {/* Back / close button */}
        <button
          type="button"
          onClick={onClose}
          title="Close whiteboard (Escape)"
          aria-label="Close whiteboard"
          className="flex h-7 w-7 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M7.22 1.22a.75.75 0 0 1 1.06 0L15 7.94a.75.75 0 0 1 0 1.06L8.28 15.72a.75.75 0 0 1-1.06-1.06l5.47-5.47H1a.75.75 0 0 1 0-1.5h11.69L7.22 2.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
              transform="rotate(180 8 8)"
            />
          </svg>
        </button>

        {/* Title */}
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {drawingTitle}
        </h1>

        {/* Status */}
        <span
          className={[
            'shrink-0 text-[11px]',
            drawingState?.saveError
              ? 'text-destructive'
              : drawingState?.isDirty
                ? 'text-yellow-500'
                : 'text-foreground-muted',
          ].join(' ')}
          aria-live="polite"
        >
          {statusText}
        </span>

        {/* Go to note */}
        {linkedNoteId && onNavigateToNote && (
          <button
            type="button"
            onClick={() => onNavigateToNote(linkedNoteId)}
            title="Open linked note"
            aria-label="Open linked note"
            className="flex items-center gap-1.5 rounded bg-accent/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M4.5 3.75a.75.75 0 0 0-1.5 0v8.5a.75.75 0 0 0 1.5 0V9.75h7.5v2.5a.75.75 0 0 0 1.5 0v-8.5a.75.75 0 0 0-1.5 0v2.5H4.5v-2.5Z" />
            </svg>
            Linked note
          </button>
        )}

        {/* Export PNG */}
        <button
          type="button"
          onClick={() => void exportDrawing('png')}
          title="Export as PNG"
          aria-label="Export drawing as PNG"
          className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          Export PNG
        </button>

        {/* Export SVG */}
        <button
          type="button"
          onClick={() => void exportDrawing('svg')}
          title="Export as SVG"
          aria-label="Export drawing as SVG"
          className="flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          Export SVG
        </button>

        {/* Save button */}
        {pluginStorage && (
          <button
            type="button"
            onClick={() => void saveDrawing()}
            disabled={!drawingState?.isDirty || drawingState.isSaving}
            title="Save drawing"
            aria-label="Save drawing"
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        {!ExcalidrawComp && (
          <div className="flex h-full items-center justify-center text-foreground-muted">
            Loading Excalidraw…
          </div>
        )}
        {loadError && (
          <div className="flex h-full items-center justify-center text-destructive">
            {loadError}
          </div>
        )}
        {ExcalidrawComp && drawingState && !loadError && (
          <ExcalidrawComp
            initialData={{
              elements: drawingState.elements,
              appState: drawingState.appState,
              files: drawingState.files,
            }}
            onChange={handleChange}
            UIOptions={{
              canvasActions: {
                export: false,
                loadScene: false,
                saveToActiveFile: false,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
