/**
 * Type declarations for @excalidraw/excalidraw.
 *
 * These declarations are minimal stubs that type-check correctly when the
 * package is not yet installed. When @excalidraw/excalidraw is installed,
 * the package's own type definitions take precedence via skipLibCheck.
 *
 * The full type definitions ship with the @excalidraw/excalidraw package
 * itself — this file only exists to enable type-checking before the package
 * is added to the lockfile.
 */

declare module '@excalidraw/excalidraw' {
  import type React from 'react';

  export interface ExcalidrawElement {
    id: string;
    type: string;
    [key: string]: unknown;
  }

  export interface AppState {
    viewBackgroundColor?: string;
    [key: string]: unknown;
  }

  export interface ExcalidrawInitialDataState {
    elements?: ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: Record<string, unknown>;
  }

  export interface ExcalidrawProps {
    initialData?: ExcalidrawInitialDataState;
    onChange?: (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: Record<string, unknown>,
    ) => void;
    UIOptions?: Record<string, unknown>;
    theme?: 'light' | 'dark';
    exportWithDarkMode?: boolean;
    onExportToBackend?: (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: Record<string, unknown>,
    ) => void;
  }

  export const Excalidraw: React.ComponentType<ExcalidrawProps>;

  export function exportToBlob(opts: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: Record<string, unknown>;
    mimeType: string;
  }): Promise<Blob>;

  export function exportToSvg(opts: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: Record<string, unknown>;
  }): Promise<SVGSVGElement>;

  export function getSceneVersion(elements: readonly ExcalidrawElement[]): number;
}
