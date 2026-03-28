/**
 * plugin-lifecycle — Plugin SDK lifecycle hooks for the Excalidraw plugin.
 *
 * These are called by the Notesaner plugin host when this plugin is loaded
 * inside a sandboxed iframe. For direct use within the host (non-sandboxed),
 * you can skip these and wire up ExcalidrawExtension directly.
 *
 * The lifecycle approach registers a slash command and a full-screen view
 * via the PluginContext API.
 */

import type { PluginContext } from '@notesaner/plugin-sdk';

let activeContext: PluginContext | null = null;

/**
 * onLoad — called once when the plugin iframe is initialized.
 *
 * Registers:
 * 1. A "New Excalidraw" command in the command palette.
 * 2. A standalone whiteboard view accessible via the UI.
 */
export async function onLoad(context: PluginContext): Promise<void> {
  activeContext = context;

  // Register command palette entry
  context.ui.registerCommand({
    id: 'excalidraw.new-drawing',
    name: 'New Excalidraw drawing',
    keybinding: undefined,
    async callback() {
      // Emit an event the host application listens to in order to insert
      // an Excalidraw embed into the currently active note's editor.
      context.events.emit('excalidraw.insert-embed', {
        filePath: `drawings/${Date.now()}.excalidraw`,
      });
    },
  });

  // Register a view for opening a whiteboard in full-screen from outside the editor
  context.ui.registerView({
    id: 'excalidraw.whiteboard',
    title: 'Whiteboard',
    render(container) {
      // Inject a minimal placeholder; the host renders ExcalidrawFullscreen
      // in the designated view container when the user navigates to it.
      container.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-family: system-ui, sans-serif;
          font-size: 13px;
          color: var(--color-text-muted, #94a3b8);
        ">
          Open an Excalidraw file to start drawing.
        </div>
      `;
      // Emit event so the host application can mount ExcalidrawFullscreen
      context.events.emit('excalidraw.view-ready', { container });
    },
  });

  context.ui.showNotification({
    message: 'Excalidraw plugin loaded',
    type: 'success',
    duration: 2000,
  });
}

/**
 * onUnload — called before the plugin iframe is destroyed.
 */
export async function onUnload(): Promise<void> {
  activeContext = null;
}

/** Expose the active context for use by other parts of the plugin. */
export function getPluginContext(): PluginContext | null {
  return activeContext;
}
