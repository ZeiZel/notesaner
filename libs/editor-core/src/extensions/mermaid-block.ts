/**
 * MermaidBlock — TipTap Node extension for Mermaid diagram rendering.
 *
 * Intercepts ```mermaid fenced code blocks and replaces the default code block
 * rendering with a split-view panel (code editor left, diagram preview right).
 *
 * Supported diagram types:
 *   flowchart, graph, sequenceDiagram, classDiagram, gantt, pie,
 *   erDiagram, journey, stateDiagram, gitGraph, quadrantChart, requirementDiagram
 *
 * Features:
 * - Live preview: debounced 300 ms render on content change
 * - Theme-aware: reads the `data-theme` attribute on `<html>` for dark/light
 * - Error overlay: displays parse errors from Mermaid with the problematic line
 * - Export: PNG via canvas serialisation, SVG via innerHTML
 * - Dynamic import of the `mermaid` library — no upfront bundle impact
 * - Input rule: typing ```mermaid inserts the node automatically
 *
 * The React NodeView (MermaidView.tsx) provides the interactive UI;
 * this file defines the headless TipTap extension.
 *
 * Usage:
 * ```ts
 * import { MermaidBlock } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   MermaidBlock.configure({ defaultTheme: 'default' }),
 * ];
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Mermaid diagram type detection
// ---------------------------------------------------------------------------

/** All recognised Mermaid diagram keywords (first word in the definition). */
export const MERMAID_DIAGRAM_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'xychart-beta',
  'requirementDiagram',
  'gitGraph',
  'mindmap',
  'timeline',
  'block-beta',
  'packet-beta',
  'architecture-beta',
] as const;

export type MermaidDiagramType = (typeof MERMAID_DIAGRAM_TYPES)[number];

/**
 * Detect the diagram type from the first non-empty line of the definition.
 * Returns `null` when the type cannot be determined.
 *
 * Types are checked in descending length order so that longer, more specific
 * names (e.g. "stateDiagram-v2") are matched before their shorter prefixes
 * (e.g. "stateDiagram").
 */
export function detectDiagramType(code: string): MermaidDiagramType | null {
  const firstLine = code
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  if (!firstLine) return null;

  // Sort by descending length to ensure longer names are tried first.
  const sorted = [...MERMAID_DIAGRAM_TYPES].sort((a, b) => b.length - a.length);

  for (const type of sorted) {
    if (firstLine.toLowerCase().startsWith(type.toLowerCase())) {
      return type;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Mermaid theme string from the current document theme.
 * Reads `data-theme` on `<html>` when available; falls back to the option.
 */
export function resolveMermaidTheme(defaultTheme: MermaidTheme): MermaidTheme {
  if (typeof document === 'undefined') return defaultTheme;

  const htmlTheme = document.documentElement.getAttribute('data-theme');

  if (htmlTheme === 'dark') return 'dark';
  if (htmlTheme === 'light') return 'default';

  // Also check for Tailwind dark-mode class
  if (document.documentElement.classList.contains('dark')) return 'dark';

  return defaultTheme;
}

/** Valid Mermaid theme values. */
export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base';

// ---------------------------------------------------------------------------
// Extension options
// ---------------------------------------------------------------------------

export interface MermaidBlockOptions {
  /**
   * Default Mermaid theme used when no document-level theme is detected.
   * Defaults to `'default'` (light theme).
   */
  defaultTheme?: MermaidTheme;

  /**
   * Debounce interval (ms) for live preview re-rendering while typing.
   * Defaults to `300`.
   */
  renderDebounceMs?: number;

  /**
   * HTML attributes merged onto the outer container element.
   */
  HTMLAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// TipTap commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      /**
       * Insert a Mermaid block at the current cursor position, optionally
       * pre-filled with a starter template for the given diagram type.
       */
      insertMermaidBlock: (options?: {
        content?: string;
        diagramType?: MermaidDiagramType;
      }) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Starter templates per diagram type
// ---------------------------------------------------------------------------

/** Default starter code for a new Mermaid block by diagram type. */
export const MERMAID_STARTERS: Record<string, string> = {
  flowchart:
    'flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Result A]\n    B -->|No| D[Result B]',
  graph: 'graph LR\n    A --> B --> C',
  sequenceDiagram:
    'sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob!\n    B-->>A: Hi Alice!',
  classDiagram:
    'classDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    Animal <|-- Dog',
  stateDiagram:
    'stateDiagram-v2\n    [*] --> Idle\n    Idle --> Running : Start\n    Running --> Idle : Stop\n    Running --> [*] : Finish',
  erDiagram: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains',
  journey:
    'journey\n    title My working day\n    section Go to work\n      Make tea: 5: Me\n      Go upstairs: 3: Me, Cat',
  gantt:
    'gantt\n    title A Gantt Diagram\n    dateFormat  YYYY-MM-DD\n    section Section\n    A task           :a1, 2024-01-01, 30d\n    Another task     :after a1, 20d',
  pie: 'pie title Pets adopted by volunteers\n    "Dogs" : 386\n    "Cats" : 85\n    "Rats" : 15',
  gitGraph:
    'gitGraph\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop',
};

/** Return a starter template for the given type or a default flowchart. */
export function getMermaidStarter(type?: string): string {
  if (type && MERMAID_STARTERS[type]) {
    return MERMAID_STARTERS[type] as string;
  }
  return MERMAID_STARTERS['flowchart'] as string;
}

// ---------------------------------------------------------------------------
// Node attribute interface
// ---------------------------------------------------------------------------

export interface MermaidBlockAttrs {
  /**
   * The raw Mermaid diagram definition (the code source).
   * Stored as the text content of the node.
   */
  code: string;

  /**
   * Detected diagram type — stored as a convenience attribute so the NodeView
   * can display a type badge without re-parsing the code.
   */
  diagramType: MermaidDiagramType | null;

  /**
   * Active Mermaid theme for this block.
   * `null` means "use the document-level default".
   */
  theme: MermaidTheme | null;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const MermaidBlock = Node.create<MermaidBlockOptions>({
  name: 'mermaidBlock',

  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: false,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      defaultTheme: 'default',
      renderDebounceMs: 300,
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Content model
  // -------------------------------------------------------------------------

  // The diagram code is stored as a single text child. `atom: true` prevents
  // the cursor from entering the node, but we still need the schema to allow
  // text content so we can persist and retrieve the code.
  content: 'text*',

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      code: {
        default: '',
        // `code` mirrors the text content — kept as an attribute for easy
        // access in renderHTML and NodeView without traversing children.
        parseHTML: (element) => element.textContent ?? '',
        renderHTML: () => ({}), // Serialised via text content, not attribute.
      },
      diagramType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-diagram-type') || null,
        renderHTML: (attributes) => {
          if (!attributes['diagramType']) return {};
          return { 'data-diagram-type': String(attributes['diagramType']) };
        },
      },
      theme: {
        default: null,
        parseHTML: (element) =>
          (element.getAttribute('data-mermaid-theme') as MermaidTheme) || null,
        renderHTML: (attributes) => {
          if (!attributes['theme']) return {};
          return {
            'data-mermaid-theme': String(attributes['theme']),
          };
        },
      },
    };
  },

  // -------------------------------------------------------------------------
  // Parse rules — match a <pre data-mermaid-block> element produced by renderHTML
  // -------------------------------------------------------------------------

  parseHTML() {
    return [
      {
        tag: 'pre[data-mermaid-block]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const code = el.textContent ?? '';
          return {
            code,
            diagramType: el.getAttribute('data-diagram-type') || null,
            theme: (el.getAttribute('data-mermaid-theme') as MermaidTheme) || null,
          };
        },
      },
    ];
  },

  // -------------------------------------------------------------------------
  // HTML render — static fallback used for SSR, copy-paste, generateHTML
  // -------------------------------------------------------------------------

  renderHTML({ node, HTMLAttributes }) {
    const code = (node.attrs['code'] as string) || node.textContent || '';
    const diagramType = node.attrs['diagramType'] as string | null;
    const theme = node.attrs['theme'] as string | null;

    const attrs = mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes, {
      'data-mermaid-block': '',
      class: 'ns-mermaid-block',
      ...(diagramType ? { 'data-diagram-type': diagramType } : {}),
      ...(theme ? { 'data-mermaid-theme': theme } : {}),
    });

    // Render as a <pre><code> block for graceful degradation (readable as markdown source)
    return ['pre', attrs, ['code', { class: 'language-mermaid' }, code]];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — emit the raw fenced code block
  // -------------------------------------------------------------------------

  renderText({ node }) {
    const code = (node.attrs['code'] as string) || node.textContent || '';
    return `\`\`\`mermaid\n${code}\n\`\`\``;
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency; MermaidView imports types
    // from this file but not the extension itself.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MermaidView } = require('../components/MermaidView') as {
      MermaidView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(MermaidView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertMermaidBlock:
        (options = {}) =>
        ({ commands }) => {
          const code = options.content ?? getMermaidStarter(options.diagramType);

          return commands.insertContent({
            type: this.name,
            attrs: {
              code,
              diagramType: detectDiagramType(code),
              theme: null,
            },
            content: code ? [{ type: 'text', text: code }] : [],
          });
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — ``` mermaid → insert MermaidBlock node
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        // Matches ```mermaid followed by optional whitespace, at end of line.
        find: /^```mermaid\s*$/,
        handler: ({ state, range }) => {
          const code = getMermaidStarter();
          const node = this.type.create(
            {
              code,
              diagramType: detectDiagramType(code),
              theme: null,
            },
            code ? [state.schema.text(code)] : [],
          );

          const { tr } = state;
          // Replace the matched ```mermaid text with the node.
          tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
