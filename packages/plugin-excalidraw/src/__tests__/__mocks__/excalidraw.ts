/**
 * Mock for @excalidraw/excalidraw in unit tests.
 *
 * Provides stub implementations of the functions used by the plugin
 * without loading the real Excalidraw library (which requires a browser
 * canvas context and is very heavy).
 */

import type { ExcalidrawElement, ExcalidrawAppState } from '../../excalidraw-store';

export const Excalidraw = () => null;
Excalidraw.displayName = 'Excalidraw';

export async function exportToBlob(opts: {
  elements: readonly ExcalidrawElement[];
  appState: Partial<ExcalidrawAppState>;
  files: Record<string, unknown>;
  mimeType: string;
}): Promise<Blob> {
  void opts;
  return new Blob(['fake-png-data'], { type: opts.mimeType });
}

export async function exportToSvg(opts: {
  elements: readonly ExcalidrawElement[];
  appState: Partial<ExcalidrawAppState>;
  files: Record<string, unknown>;
}): Promise<SVGSVGElement> {
  void opts;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '800');
  svg.setAttribute('height', '600');
  return svg;
}

export function getSceneVersion(elements: readonly ExcalidrawElement[]): number {
  return elements.length;
}
