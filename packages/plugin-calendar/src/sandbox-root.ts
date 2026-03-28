/**
 * sandbox-root — dynamically-imported helper that bootstraps the CalendarView
 * React component inside a sandboxed plugin iframe.
 *
 * This module is intentionally split out so it is not included in the primary
 * bundle; it is only loaded on-demand when the user opens the calendar view.
 */

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { CalendarView } from './CalendarView';

/**
 * Mount a CalendarView React root into `container`.
 * Called by the onLoad view render callback in index.ts.
 */
export function createCalendarRoot(container: HTMLElement, ctx: PluginContext): void {
  const root = createRoot(container);
  root.render(createElement(CalendarView, { ctx }));
}
