/**
 * sandbox-root — Bootstraps the DailyNotesPanel React component inside a
 * sandboxed plugin iframe.
 *
 * This module is dynamically imported only when the sidebar panel view is
 * first opened, keeping the initial bundle lean.
 */

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { DailyNotesPanel } from './DailyNotesPanel';

/**
 * Mount a DailyNotesPanel into a fresh HTMLElement and return that element.
 * Called by the sidebar panel render callback in index.ts.
 */
export function createDailyNotesPanelElement(ctx: PluginContext): HTMLElement {
  const container = document.createElement('div');
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(createElement(DailyNotesPanel, { ctx }));
  return container;
}
