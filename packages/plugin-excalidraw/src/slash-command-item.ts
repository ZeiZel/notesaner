/**
 * EXCALIDRAW_SLASH_ITEM — slash command item that inserts an Excalidraw embed.
 *
 * This item overrides the stub entry in the built-in BUILT_IN_SLASH_ITEMS list
 * (id: 'excalidraw') by providing a real onSelect implementation. When the
 * plugin is loaded, the host application should pass this item to:
 *
 * ```ts
 * SlashCommand.configure({ extraItems: [EXCALIDRAW_SLASH_ITEM] });
 * ```
 *
 * The built-in stub (which is already in BUILT_IN_SLASH_ITEMS) will be
 * superseded because extraItems are merged last. The menu component deduplicates
 * items by id and prefers later entries.
 *
 * If the editor does not yet have the ExcalidrawExtension registered, the
 * command is a no-op with a console warning.
 */

import type { EditorView } from '@tiptap/pm/view';

// We declare the minimal type locally instead of importing from @notesaner/editor-core
// (SlashCommandItem is not re-exported from the library index) to avoid a
// circular dependency. The shape is structurally compatible with the original.
type SlashCommandGroup = 'Text' | 'Media' | 'Structure' | 'Advanced';

interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  group: SlashCommandGroup;
  keywords?: string[];
  onSelect: (view: EditorView, triggerPos: number, query: string) => void;
}

function deleteSlashTrigger(view: EditorView, triggerPos: number, query: string) {
  const { state, dispatch } = view;
  const from = triggerPos - 1;
  const to = triggerPos + query.length;
  if (from >= 0 && to <= state.doc.content.size) {
    dispatch(state.tr.deleteRange(from, to));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEditor(view: EditorView): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (view as any).props?.editor ?? (view as any)._editor ?? null;
}

export const EXCALIDRAW_SLASH_ITEM: SlashCommandItem = {
  id: 'excalidraw',
  title: 'Excalidraw',
  description: 'Embed an Excalidraw whiteboard drawing',
  icon: 'pencil',
  group: 'Advanced',
  keywords: ['excalidraw', 'draw', 'sketch', 'diagram', 'canvas', 'whiteboard'],

  onSelect(view, triggerPos, query) {
    deleteSlashTrigger(view, triggerPos, query);

    const editor = getEditor(view);
    if (!editor) {
      console.warn('[plugin-excalidraw] No editor found on view');
      return;
    }

    const hasExtension = editor.extensionManager?.extensions?.some(
      (ext: { name: string }) => ext.name === 'excalidrawEmbed',
    );

    if (!hasExtension) {
      console.warn(
        '[plugin-excalidraw] ExcalidrawExtension is not registered. ' +
          'Add it to your editor extensions before using the slash command.',
      );
      return;
    }

    editor.commands.insertExcalidrawEmbed();
    editor.view.focus();
  },
};
