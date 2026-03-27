/**
 * Snap Layout Types
 *
 * Defines layout template configurations for the Windows 11-style
 * snap layout picker.
 */

export type SnapTemplateId =
  | 'single'
  | 'split-50-50'
  | 'split-70-30'
  | 'split-30-70'
  | 'three-columns'
  | 'two-x-two'
  | 'main-sidebar-right'
  | 'main-sidebar-left';

export interface SnapPanel {
  /** Unique panel identifier within the template */
  id: string;
  /** Column start (1-indexed, CSS Grid) */
  colStart: number;
  /** Column end (1-indexed, CSS Grid, exclusive) */
  colEnd: number;
  /** Row start (1-indexed, CSS Grid) */
  rowStart: number;
  /** Row end (1-indexed, CSS Grid, exclusive) */
  rowEnd: number;
}

export interface SnapTemplate {
  id: SnapTemplateId;
  label: string;
  /** CSS Grid column template, e.g. "1fr 1fr" */
  gridCols: string;
  /** CSS Grid row template, e.g. "1fr 1fr" */
  gridRows: string;
  panels: SnapPanel[];
}

export interface SavedLayout {
  id: string;
  name: string;
  templateId: SnapTemplateId;
  /** Custom panel size ratios after user drag-resize */
  customRatios?: number[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Built-in preset templates
// ---------------------------------------------------------------------------

export const SNAP_TEMPLATES: SnapTemplate[] = [
  {
    id: 'single',
    label: 'Single',
    gridCols: '1fr',
    gridRows: '1fr',
    panels: [{ id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 }],
  },
  {
    id: 'split-50-50',
    label: '50 / 50',
    gridCols: '1fr 1fr',
    gridRows: '1fr',
    panels: [
      { id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { id: 'p2', colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: 'split-70-30',
    label: '70 / 30',
    gridCols: '7fr 3fr',
    gridRows: '1fr',
    panels: [
      { id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { id: 'p2', colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: 'split-30-70',
    label: '30 / 70',
    gridCols: '3fr 7fr',
    gridRows: '1fr',
    panels: [
      { id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { id: 'p2', colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: 'three-columns',
    label: '3 Columns',
    gridCols: '1fr 1fr 1fr',
    gridRows: '1fr',
    panels: [
      { id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { id: 'p2', colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { id: 'p3', colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2 },
    ],
  },
  {
    id: 'two-x-two',
    label: '2 × 2',
    gridCols: '1fr 1fr',
    gridRows: '1fr 1fr',
    panels: [
      { id: 'p1', colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2 },
      { id: 'p2', colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2 },
      { id: 'p3', colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3 },
      { id: 'p4', colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3 },
    ],
  },
];
