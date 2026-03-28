'use client';

/**
 * ExcalidrawEmbed — React NodeView for the excalidrawEmbed TipTap node.
 *
 * Features:
 * - Lazy-loads @excalidraw/excalidraw via dynamic import (heavy dependency).
 * - Loads drawing data from plugin storage on mount.
 * - Auto-saves with a 1 s debounce on every change.
 * - Resize handle at the bottom border: drag to change embed height.
 * - Toolbar: Open Fullscreen, Export PNG, Export SVG, Save.
 * - Displays save status (dirty indicator, "Saving…", "Saved", error).
 * - Propagates height changes back to the TipTap node via updateAttributes.
 *
 * The component intentionally avoids useEffect for data synchronization —
 * loading is initiated in a useEffect only because it requires async I/O with
 * the plugin storage API (a valid external store interaction).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  useExcalidrawStore,
  serializeDrawing,
  parseExcalidrawFile,
  DEFAULT_APP_STATE,
} from './excalidraw-store';
import type { ExcalidrawElement, ExcalidrawAppState, ExcalidrawFileData } from './excalidraw-store';
import type { ExcalidrawNodeAttrs, ExcalidrawNodeOptions } from './excalidraw-extension';
import { DEFAULT_EMBED_HEIGHT, MIN_EMBED_HEIGHT, MAX_EMBED_HEIGHT } from './excalidraw-extension';

// ---------------------------------------------------------------------------
// Dynamic import — Excalidraw is loaded lazily to keep the initial bundle lean
// ---------------------------------------------------------------------------

import type { ExcalidrawProps } from '@excalidraw/excalidraw';

type ExcalidrawComponent = React.ComponentType<ExcalidrawProps>;

// ---------------------------------------------------------------------------
// Save debounce
// ---------------------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ExcalidrawEmbed is used as a TipTap ReactNodeView.
 * It receives NodeViewProps from TipTap and renders the Excalidraw canvas.
 */
export function ExcalidrawEmbed({ node, updateAttributes, editor }: NodeViewProps) {
  const attrs = node.attrs as ExcalidrawNodeAttrs;
  const options = (editor.extensionManager.extensions.find((ext) => ext.name === 'excalidrawEmbed')
    ?.options ?? {}) as ExcalidrawNodeOptions;

  const filePath = attrs.filePath ?? `drawings/${Date.now()}.excalidraw`;
  const embedHeight = attrs.height ?? DEFAULT_EMBED_HEIGHT;

  // ---------------------------------------------------------------------------
  // Store access
  // ---------------------------------------------------------------------------

  const drawingState = useExcalidrawStore((s) => s.drawings.get(filePath));
  const { initDrawing, updateDrawing, setSaving, markSaved, setSaveError, removeDrawing } =
    useExcalidrawStore((s) => s.actions);

  // ---------------------------------------------------------------------------
  // Lazy-loaded Excalidraw component
  // ---------------------------------------------------------------------------

  const [ExcalidrawComponent, setExcalidrawComponent] = useState<ExcalidrawComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('@excalidraw/excalidraw').then((mod) => {
      if (!cancelled) {
        setExcalidrawComponent(() => mod.Excalidraw as ExcalidrawComponent);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load drawing data from plugin storage on mount
  // ---------------------------------------------------------------------------

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (drawingState) return; // Already loaded by a previous mount of this embed

    // Try to load from plugin storage (key = file path)
    // The host application injects pluginStorage into editor storage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginStorage = (editor.storage as any)?.pluginStorage as
      | { get: (key: string) => Promise<string | undefined> }
      | undefined;

    async function loadDrawing() {
      if (pluginStorage) {
        try {
          const raw = await pluginStorage.get(`excalidraw:${filePath}`);
          if (raw) {
            const data = parseExcalidrawFile(raw);
            initDrawing(filePath, data);
            return;
          }
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load drawing');
        }
      }

      // No persisted data found — initialize with an empty drawing
      const emptyData: ExcalidrawFileData = {
        type: 'excalidraw',
        version: 2,
        elements: [],
        appState: DEFAULT_APP_STATE,
        files: {},
      };
      initDrawing(filePath, emptyData);
    }

    void loadDrawing();

    return () => {
      removeDrawing(filePath);
    };
  }, [filePath]);

  // ---------------------------------------------------------------------------
  // Auto-save with debounce
  // ---------------------------------------------------------------------------

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDrawing = useCallback(async () => {
    if (!drawingState?.isDirty) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginStorage = (editor.storage as any)?.pluginStorage as
      | { set: (key: string, value: string) => Promise<void> }
      | undefined;

    setSaving(filePath, true);

    try {
      const serialized = serializeDrawing(drawingState);
      const json = JSON.stringify(serialized, null, 2);

      if (pluginStorage) {
        await pluginStorage.set(`excalidraw:${filePath}`, json);
      }

      markSaved(filePath);
    } catch (err) {
      setSaveError(filePath, err instanceof Error ? err.message : 'Save failed');
    }
  }, [drawingState, filePath, setSaving, markSaved, setSaveError, editor.storage]);

  // Trigger debounced save when drawing becomes dirty
  useEffect(() => {
    if (!drawingState?.isDirty) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDrawing();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [drawingState?.isDirty, saveDrawing]);

  // ---------------------------------------------------------------------------
  // Excalidraw change handler
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
  // Export handlers
  // ---------------------------------------------------------------------------

  const handleExportPng = useCallback(async () => {
    if (!drawingState) return;
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');

      const blob = await exportToBlob({
        elements: drawingState.elements,
        appState: drawingState.appState,
        files: drawingState.files,
        mimeType: 'image/png',
      });

      if (options.onExport) {
        await options.onExport(filePath, 'png', blob);
      } else {
        // Fallback: trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = filePath.split('/').pop()?.replace('.excalidraw', '') ?? 'drawing';
        a.href = url;
        a.download = `${fileName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setSaveError(filePath, err instanceof Error ? err.message : 'PNG export failed');
    }
  }, [drawingState, filePath, options, setSaveError]);

  const handleExportSvg = useCallback(async () => {
    if (!drawingState) return;
    try {
      const { exportToSvg } = await import('@excalidraw/excalidraw');

      const svgEl = await exportToSvg({
        elements: drawingState.elements,
        appState: drawingState.appState,
        files: drawingState.files,
      });

      const svgString = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });

      if (options.onExport) {
        await options.onExport(filePath, 'svg', blob);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = filePath.split('/').pop()?.replace('.excalidraw', '') ?? 'drawing';
        a.href = url;
        a.download = `${fileName}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setSaveError(filePath, err instanceof Error ? err.message : 'SVG export failed');
    }
  }, [drawingState, filePath, options, setSaveError]);

  const handleOpenFullscreen = useCallback(() => {
    if (options.onOpenFullscreen) {
      options.onOpenFullscreen(filePath);
    }
  }, [filePath, options]);

  // ---------------------------------------------------------------------------
  // Resize handle
  // ---------------------------------------------------------------------------

  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(embedHeight);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = embedHeight;

      function onMouseMove(ev: MouseEvent) {
        if (!isDraggingRef.current) return;
        const delta = ev.clientY - dragStartYRef.current;
        const newHeight = Math.max(
          MIN_EMBED_HEIGHT,
          Math.min(MAX_EMBED_HEIGHT, dragStartHeightRef.current + delta),
        );
        updateAttributes({ height: newHeight });
      }

      function onMouseUp() {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [embedHeight, updateAttributes],
  );

  // ---------------------------------------------------------------------------
  // Status bar text
  // ---------------------------------------------------------------------------

  const statusText = useMemo(() => {
    if (!drawingState) return 'Loading…';
    if (loadError) return `Error: ${loadError}`;
    if (drawingState.isSaving) return 'Saving…';
    if (drawingState.saveError) return `Save failed: ${drawingState.saveError}`;
    if (drawingState.isDirty) return 'Unsaved changes';
    if (drawingState.lastSaved) {
      const time = new Date(drawingState.lastSaved).toLocaleTimeString();
      return `Saved at ${time}`;
    }
    return 'New drawing';
  }, [drawingState, loadError]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="div"
      className="ns-excalidraw-embed-wrapper my-4 rounded-lg border border-border bg-card shadow-sm overflow-hidden"
      data-drag-handle
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-card/80 px-3 py-1.5">
        <span className="mr-auto truncate text-[11px] text-foreground-muted">
          {filePath.split('/').pop() ?? 'drawing.excalidraw'}
        </span>

        {/* Status indicator */}
        <span
          className={[
            'text-[10px]',
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

        {/* Fullscreen button */}
        {options.onOpenFullscreen && (
          <button
            type="button"
            onClick={handleOpenFullscreen}
            title="Open in fullscreen"
            aria-label="Open whiteboard in fullscreen"
            className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M1.75 1h3.5a.75.75 0 0 1 0 1.5H2.5V5.75a.75.75 0 0 1-1.5 0v-3.5C1 1.784 1.336 1 1.75 1Zm9 0h3.5c.414 0 .75.336.75.75v3.5a.75.75 0 0 1-1.5 0V2.5H10.75a.75.75 0 0 1 0-1.5ZM1 10.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5H2.5v2.25h2.25a.75.75 0 0 1 0 1.5h-3.5C.784 15 0 14.664 0 14.25v-4Zm13.25-.75a.75.75 0 0 1 .75.75v4c0 .414-.336.75-.75.75h-3.5a.75.75 0 0 1 0-1.5h2.75v-2.25H11.5a.75.75 0 0 1 0-1.5h1.75v-.5a.75.75 0 0 1 .75-.75Z" />
            </svg>
          </button>
        )}

        {/* Export PNG */}
        <button
          type="button"
          onClick={handleExportPng}
          title="Export as PNG"
          aria-label="Export drawing as PNG"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          PNG
        </button>

        {/* Export SVG */}
        <button
          type="button"
          onClick={handleExportSvg}
          title="Export as SVG"
          aria-label="Export drawing as SVG"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          SVG
        </button>

        {/* Manual save button */}
        <button
          type="button"
          onClick={() => void saveDrawing()}
          disabled={!drawingState?.isDirty || drawingState.isSaving}
          title="Save drawing"
          aria-label="Save drawing now"
          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ height: embedHeight }} className="relative w-full">
        {!ExcalidrawComponent && (
          <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
            Loading Excalidraw…
          </div>
        )}
        {ExcalidrawComponent && !drawingState && !loadError && (
          <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
            Initializing drawing…
          </div>
        )}
        {loadError && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {loadError}
          </div>
        )}
        {ExcalidrawComponent && drawingState && !loadError && (
          <ExcalidrawComponent
            initialData={{
              elements: drawingState.elements,
              appState: drawingState.appState,
              files: drawingState.files,
            }}
            onChange={handleChange}
            UIOptions={{
              canvasActions: {
                export: false, // We provide our own export buttons
                loadScene: false,
                saveToActiveFile: false,
              },
            }}
          />
        )}
      </div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-label="Resize embed height"
        aria-orientation="horizontal"
        className="flex h-2.5 cursor-ns-resize items-center justify-center border-t border-border bg-card/60 hover:bg-accent"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      >
        <span className="block h-0.5 w-8 rounded-full bg-border" aria-hidden="true" />
      </div>
    </NodeViewWrapper>
  );
}
