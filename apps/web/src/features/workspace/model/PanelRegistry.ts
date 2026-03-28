/**
 * PanelRegistry — central registry for sidebar panel definitions.
 *
 * Both built-in panels and plugin-registered panels are registered here.
 * The registry maps a panel type ID to its metadata (title, icon, default
 * sidebar assignment). The sidebar store references panel types by ID;
 * the registry provides the rendering metadata.
 *
 * Plugin panels register via `registerPanel()` at runtime. Built-in panels
 * are registered at module load time.
 */

import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarSide = 'left' | 'right';

export interface PanelDefinition {
  /** Unique panel type identifier (e.g. 'files', 'outline', 'plugin-kanban'). */
  id: string;
  /** Human-readable title shown in the panel header. */
  title: string;
  /** SVG icon path(s) for a 16x16 viewBox. Rendered inside a <svg>. */
  iconPath: string;
  /** Which sidebar the panel belongs to by default. */
  defaultSidebar: SidebarSide;
  /** Default order within its sidebar (lower = higher). */
  defaultOrder: number;
  /**
   * Optional React component to render as panel content.
   * If not provided, the panel renders a placeholder.
   * This allows lazy registration by plugins.
   */
  component?: ComponentType<Record<string, unknown>>;
  /** Whether this panel was registered by a plugin. */
  isPlugin?: boolean;
  /** Optional action buttons rendered in the panel header. */
  headerActions?: PanelHeaderAction[];
}

export interface PanelHeaderAction {
  id: string;
  label: string;
  iconPath: string;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Built-in panel definitions
// ---------------------------------------------------------------------------

const BUILT_IN_PANELS: PanelDefinition[] = [
  // -- Left sidebar panels --
  {
    id: 'files',
    title: 'File Explorer',
    iconPath:
      'M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z',
    defaultSidebar: 'left',
    defaultOrder: 0,
  },
  {
    id: 'search',
    title: 'Search',
    iconPath:
      'M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.867-3.834zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z',
    defaultSidebar: 'left',
    defaultOrder: 1,
  },
  {
    id: 'bookmarks',
    title: 'Bookmarks',
    iconPath:
      'M3.75 2a.75.75 0 00-.75.75v11.5a.75.75 0 001.28.53L8 11.06l3.72 3.72a.75.75 0 001.28-.53V2.75a.75.75 0 00-.75-.75h-8.5z',
    defaultSidebar: 'left',
    defaultOrder: 2,
  },
  {
    id: 'tags',
    title: 'Tags',
    iconPath:
      'M1.5 7.775V2.75a.25.25 0 01.25-.25h5.025a.25.25 0 01.177.073l6.25 6.25a.25.25 0 010 .354l-5.025 5.025a.25.25 0 01-.354 0l-6.25-6.25a.25.25 0 01-.073-.177zM4.75 6.5a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z',
    defaultSidebar: 'left',
    defaultOrder: 3,
  },

  // -- Right sidebar panels --
  {
    id: 'outline',
    title: 'Outline',
    iconPath:
      'M2 4a1 1 0 011-1h10a1 1 0 010 2H3a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 010 2H5a1 1 0 01-1-1zm2 4a1 1 0 011-1h6a1 1 0 010 2H7a1 1 0 01-1-1z',
    defaultSidebar: 'right',
    defaultOrder: 0,
  },
  {
    id: 'backlinks',
    title: 'Backlinks',
    iconPath:
      'M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z',
    defaultSidebar: 'right',
    defaultOrder: 1,
  },
  {
    id: 'properties',
    title: 'Properties',
    iconPath:
      'M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25h-8.5zM5 6.5A.75.75 0 015.75 5.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 015 6.5zm.75 2.75a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z',
    defaultSidebar: 'right',
    defaultOrder: 2,
  },
  {
    id: 'comments',
    title: 'Comments',
    iconPath:
      'M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5z',
    defaultSidebar: 'right',
    defaultOrder: 3,
  },
];

// ---------------------------------------------------------------------------
// Registry singleton
// ---------------------------------------------------------------------------

const panelMap = new Map<string, PanelDefinition>();

// Register built-in panels
for (const panel of BUILT_IN_PANELS) {
  panelMap.set(panel.id, panel);
}

/**
 * Register a new panel type (typically from a plugin).
 * If a panel with the same ID already exists, it will be overwritten.
 */
export function registerPanel(definition: PanelDefinition): void {
  panelMap.set(definition.id, { ...definition, isPlugin: true });
}

/**
 * Unregister a panel type by ID (e.g. when a plugin is disabled).
 */
export function unregisterPanel(id: string): void {
  const def = panelMap.get(id);
  if (def?.isPlugin) {
    panelMap.delete(id);
  }
}

/**
 * Get a panel definition by type ID.
 */
export function getPanelDefinition(id: string): PanelDefinition | undefined {
  return panelMap.get(id);
}

/**
 * Get all registered panel definitions.
 */
export function getAllPanelDefinitions(): PanelDefinition[] {
  return Array.from(panelMap.values());
}

/**
 * Get the default panel layout, sorted by default sidebar and order.
 */
export function getDefaultPanelLayout(): {
  left: string[];
  right: string[];
} {
  const left: { id: string; order: number }[] = [];
  const right: { id: string; order: number }[] = [];

  for (const panel of panelMap.values()) {
    if (panel.defaultSidebar === 'left') {
      left.push({ id: panel.id, order: panel.defaultOrder });
    } else {
      right.push({ id: panel.id, order: panel.defaultOrder });
    }
  }

  left.sort((a, b) => a.order - b.order);
  right.sort((a, b) => a.order - b.order);

  return {
    left: left.map((p) => p.id),
    right: right.map((p) => p.id),
  };
}
