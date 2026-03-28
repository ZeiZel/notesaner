'use client';

/**
 * TemplatePicker — workspace-level modal for selecting a template when creating
 * a new note.
 *
 * This is the workspace feature integration layer that wraps the plugin-level
 * TemplatePicker component. It:
 *   - Connects to the workspace context (auth, workspace ID, active user).
 *   - Provides onApply callback that creates the note with rendered template content.
 *   - Supports template variables: {{title}}, {{date}}, {{author}}.
 *   - Templates are stored as markdown files in the .templates/ folder.
 *
 * Design:
 *   - State is managed entirely by the template-store (Zustand).
 *   - No useEffect for store interactions; all via event handlers.
 *   - Delegates UI to the plugin-templates TemplatePicker component.
 *   - Creates notes via the workspace API after template rendering.
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TemplatePicker as PluginTemplatePicker,
  useTemplateStore,
  renderTemplate,
  type CustomVariableValues,
} from '@notesaner/plugin-templates';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { NoteDto, CreateNoteDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceTemplatePickerProps {
  workspaceId: string;
  /** Default folder path for the new note. */
  folderPath?: string;
  /** Pre-filled note title. */
  noteTitle?: string;
  /** Called after the note is successfully created from a template. */
  onNoteCreated?: (note: NoteDto) => void;
  /** Called when the picker is cancelled. */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function createNote(
  token: string,
  workspaceId: string,
  dto: CreateNoteDto,
): Promise<NoteDto> {
  return apiClient.post<NoteDto>(`/api/workspaces/${workspaceId}/notes`, dto, { token });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceTemplatePicker({
  workspaceId,
  folderPath = '',
  noteTitle = '',
  onNoteCreated,
  onCancel,
}: WorkspaceTemplatePickerProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const store = useTemplateStore();

  const authorName = user?.displayName ?? user?.email ?? '';

  const createNoteMutation = useMutation({
    mutationFn: async ({
      templateId,
      variables,
    }: {
      templateId: string;
      variables: CustomVariableValues;
    }) => {
      if (!accessToken) throw new Error('Not authenticated');

      // Find the selected template
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) throw new Error(`Template not found: ${templateId}`);

      // Render the template with variables
      const title = noteTitle || template.meta.name;
      const result = renderTemplate(template.body, {
        title,
        author: authorName,
        variables,
      });

      // Build the note path
      const sanitizedTitle = title
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, '-')
        .toLowerCase();
      const normalizedFolder = folderPath.replace(/\/+$/, '');
      const path = normalizedFolder
        ? `${normalizedFolder}/${sanitizedTitle}.md`
        : `${sanitizedTitle}.md`;

      // Extract tags from template metadata
      const tags = template.meta.tags.length > 0 ? template.meta.tags : undefined;

      return createNote(accessToken, workspaceId, {
        path,
        title,
        content: result.content,
        tags,
      });
    },
    onSuccess: (newNote) => {
      void queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['file-tree', workspaceId] });
      onNoteCreated?.(newNote);
    },
  });

  // Open picker with appropriate context when this component mounts
  // We use a ref-check pattern to open the picker on first render only
  const handleOpen = useCallback(() => {
    store.openPicker({
      noteTitle,
      folderPath,
      onApply: (templateId: string, variables: CustomVariableValues) => {
        createNoteMutation.mutate({ templateId, variables });
      },
      onCancel: () => {
        onCancel?.();
      },
    });
  }, [store, noteTitle, folderPath, createNoteMutation, onCancel]);

  return (
    <>
      {/* Trigger button to open the picker */}
      {!store.isPickerOpen && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={createNoteMutation.isPending}
          className={[
            'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3',
            'bg-primary text-primary-foreground text-sm font-medium',
            'hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          ].join(' ')}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M2 3.75C2 2.784 2.784 2 3.75 2h4.586a1.75 1.75 0 011.237.512l3.915 3.915a1.75 1.75 0 01.512 1.237V12.25A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25V3.75z" />
          </svg>
          {createNoteMutation.isPending ? 'Creating...' : 'From template'}
        </button>
      )}

      {/* The actual picker modal (from plugin-templates) */}
      <PluginTemplatePicker author={authorName} />

      {/* Error feedback */}
      {createNoteMutation.isError && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          Failed to create note from template. Please try again.
        </p>
      )}
    </>
  );
}
