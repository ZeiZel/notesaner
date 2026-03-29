/**
 * mermaid-extension.ts — Feature-level Mermaid extension integration.
 *
 * Re-exports the MermaidBlock TipTap extension from @notesaner/editor-core
 * and provides helper utilities for the editor feature layer.
 *
 * Responsibilities:
 * - Expose a pre-configured MermaidBlock extension with project defaults
 * - Provide the insertMermaidBlock command helper for toolbar integration
 * - Export starter templates and diagram type utilities
 *
 * Usage:
 * ```ts
 * import { createMermaidExtension, MERMAID_TOOLBAR_ITEMS } from '@/features/editor/lib/mermaid-extension';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   createMermaidExtension(),
 * ];
 * ```
 *
 * The actual NodeView rendering is handled by MermaidView in @notesaner/editor-core.
 * The Ant Design toolbar component lives in MermaidPreview.tsx (this feature's ui/ layer).
 */

import {
  MermaidBlock,
  getMermaidStarter,
  detectDiagramType,
  MERMAID_DIAGRAM_TYPES,
  MERMAID_STARTERS,
  resolveMermaidTheme,
  type MermaidBlockOptions,
  type MermaidDiagramType,
  type MermaidTheme,
} from '@notesaner/editor-core';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export {
  getMermaidStarter,
  detectDiagramType,
  MERMAID_DIAGRAM_TYPES,
  MERMAID_STARTERS,
  resolveMermaidTheme,
};
export type { MermaidBlockOptions, MermaidDiagramType, MermaidTheme };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Default render debounce in ms. Matches the live preview update delay.
 * Kept slightly higher than typing speed to avoid excessive renders.
 */
const DEFAULT_RENDER_DEBOUNCE_MS = 300;

/**
 * Creates a pre-configured MermaidBlock extension for use in the editor.
 *
 * @param options - Override any MermaidBlockOptions defaults.
 */
export function createMermaidExtension(options?: Partial<MermaidBlockOptions>) {
  return MermaidBlock.configure({
    defaultTheme: 'default',
    renderDebounceMs: DEFAULT_RENDER_DEBOUNCE_MS,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Toolbar integration helpers
// ---------------------------------------------------------------------------

/**
 * Programmatically inserts a Mermaid block at the current cursor position.
 *
 * @param editor - The active TipTap editor instance.
 * @param diagramType - Optional diagram type; defaults to 'flowchart'.
 * @param content - Optional raw Mermaid source (overrides the starter template).
 * @returns `true` when the command succeeded.
 */
export function insertMermaidBlock(
  editor: Editor,
  diagramType?: MermaidDiagramType,
  content?: string,
): boolean {
  return editor.chain().focus().insertMermaidBlock({ diagramType, content }).run();
}

// ---------------------------------------------------------------------------
// Toolbar descriptor items
// ---------------------------------------------------------------------------

/** A toolbar item descriptor for a specific Mermaid diagram type. */
export interface MermaidToolbarItem {
  /** Human-readable label shown in menus. */
  label: string;
  /** The Mermaid diagram type keyword. */
  diagramType: MermaidDiagramType;
  /** Short description for tooltip / aria-label. */
  description: string;
}

/**
 * Curated set of diagram types shown in the editor toolbar insert menu.
 * Ordered from most commonly used to most specialised.
 */
export const MERMAID_TOOLBAR_ITEMS: MermaidToolbarItem[] = [
  {
    label: 'Flowchart',
    diagramType: 'flowchart',
    description: 'Insert a flowchart diagram',
  },
  {
    label: 'Sequence',
    diagramType: 'sequenceDiagram',
    description: 'Insert a sequence diagram',
  },
  {
    label: 'Class',
    diagramType: 'classDiagram',
    description: 'Insert a class diagram',
  },
  {
    label: 'ER Diagram',
    diagramType: 'erDiagram',
    description: 'Insert an entity-relationship diagram',
  },
  {
    label: 'Gantt',
    diagramType: 'gantt',
    description: 'Insert a Gantt chart',
  },
  {
    label: 'Pie Chart',
    diagramType: 'pie',
    description: 'Insert a pie chart',
  },
  {
    label: 'Git Graph',
    diagramType: 'gitGraph',
    description: 'Insert a Git branch graph',
  },
  {
    label: 'State',
    diagramType: 'stateDiagram',
    description: 'Insert a state diagram',
  },
  {
    label: 'Journey',
    diagramType: 'journey',
    description: 'Insert a user journey diagram',
  },
];

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the TipTap editor has the mermaidBlock extension registered.
 */
export function hasMermaidExtension(editor: Editor | null): boolean {
  if (!editor) return false;
  return editor.extensionManager.extensions.some((ext) => ext.name === 'mermaidBlock');
}
