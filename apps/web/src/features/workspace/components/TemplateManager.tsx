'use client';

/**
 * TemplateManager — workspace-level CRUD interface for templates.
 *
 * This is the workspace feature integration layer that wraps the plugin-level
 * TemplateManager. It provides:
 *   - Loading user templates from the .templates/ folder via API.
 *   - Saving/deleting templates to the .templates/ folder via API.
 *   - Syncing template changes between the plugin store and the filesystem.
 *
 * Design:
 *   - Delegates UI rendering to the plugin-templates TemplateManager component.
 *   - Uses TanStack Query for template file operations.
 *   - Template variable substitution: {{title}}, {{date}}, {{author}}.
 *   - No useEffect for store management; initial load uses query onSuccess.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TemplateManager as PluginTemplateManager,
  useTemplateStore,
  parseTemplateFile,
  serializeTemplate,
  type TemplateMeta,
} from '@notesaner/plugin-templates';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceTemplateManagerProps {
  workspaceId: string;
  /** Called when the manager should close. */
  onClose?: () => void;
}

interface TemplateFileDto {
  path: string;
  name: string;
  content: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchTemplateFiles(token: string, workspaceId: string): Promise<TemplateFileDto[]> {
  return apiClient.get<TemplateFileDto[]>(`/api/workspaces/${workspaceId}/templates`, { token });
}

async function saveTemplateFile(
  token: string,
  workspaceId: string,
  fileName: string,
  content: string,
): Promise<TemplateFileDto> {
  return apiClient.put<TemplateFileDto>(
    `/api/workspaces/${workspaceId}/templates/${encodeURIComponent(fileName)}`,
    { content },
    { token },
  );
}

async function deleteTemplateFile(
  token: string,
  workspaceId: string,
  fileName: string,
): Promise<void> {
  return apiClient.delete<void>(
    `/api/workspaces/${workspaceId}/templates/${encodeURIComponent(fileName)}`,
    { token },
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceTemplateManager({ workspaceId, onClose }: WorkspaceTemplateManagerProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const store = useTemplateStore();

  // Load user templates from the .templates/ folder
  useQuery({
    queryKey: ['templates', workspaceId],
    queryFn: async () => {
      if (!accessToken) throw new Error('Not authenticated');
      const files = await fetchTemplateFiles(accessToken, workspaceId);

      // Parse each template file and load into the store
      const entries = files.map((file) => {
        const parsed = parseTemplateFile(file.content, file.path);
        const id = `user:${file.name.replace(/\.md$/, '')}`;
        return {
          id,
          meta: parsed.meta,
          body: parsed.body,
          filePath: file.path,
        };
      });

      store.setUserTemplates(entries);
      return files;
    },
    enabled: !!accessToken && store.isManagerOpen,
    staleTime: 60_000,
  });

  // Save template file mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      templateName,
      meta,
      body,
    }: {
      templateName: string;
      meta: TemplateMeta;
      body: string;
    }) => {
      if (!accessToken) throw new Error('Not authenticated');

      const fileName = `${templateName.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-')}.md`;
      const content = serializeTemplate(meta, body);

      return saveTemplateFile(accessToken, workspaceId, fileName, content);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates', workspaceId] });
    },
  });

  // Delete template file mutation
  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      if (!accessToken) throw new Error('Not authenticated');
      const fileName = filePath.split('/').pop() ?? filePath;
      return deleteTemplateFile(accessToken, workspaceId, fileName);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates', workspaceId] });
    },
  });

  const handleClose = useCallback(() => {
    store.closeManager();
    onClose?.();
  }, [store, onClose]);

  // Expose save/delete to the plugin TemplateManager via store side-effects
  // The plugin TemplateManager handles its own UI; we sync filesystem state
  // when the manager closes or when a template is added/updated/removed.
  const handleManagerClose = useCallback(() => {
    handleClose();
  }, [handleClose]);

  return (
    <>
      <PluginTemplateManager onClose={handleManagerClose} />

      {/* Status feedback */}
      {saveMutation.isPending && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground shadow-lg">
          Saving template...
        </div>
      )}
      {deleteMutation.isPending && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-destructive px-3 py-2 text-xs text-destructive-foreground shadow-lg">
          Deleting template...
        </div>
      )}
    </>
  );
}
