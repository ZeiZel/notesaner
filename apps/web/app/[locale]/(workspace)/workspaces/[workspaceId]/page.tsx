'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useTabStore } from '@/shared/stores/tab-store';
import { notesApi } from '@/shared/api/notes';

/**
 * Workspace home page — shown when no note is selected.
 * Displays a welcome state with quick actions for creating notes and searching.
 */
export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const accessToken = useAuthStore((s) => s.accessToken);
  const openTab = useTabStore((s) => s.openTab);
  const router = useRouter();

  const handleNewNote = useCallback(async () => {
    if (!accessToken || !workspaceId) return;

    const timestamp = Date.now();
    const title = 'Untitled';
    const path = `Untitled-${timestamp}.md`;

    try {
      const note = await notesApi.create(accessToken, workspaceId, {
        path,
        title,
        content: '',
      });
      openTab({ noteId: note.id, title: note.title, path: note.path });
      router.push(`/workspaces/${workspaceId}/notes/${note.id}`);
    } catch {
      // Fallback: open a local untitled tab
      const fallbackId = `untitled-${timestamp}`;
      openTab({ noteId: fallbackId, title, path });
    }
  }, [accessToken, workspaceId, openTab, router]);

  const handleSearch = useCallback(() => {
    // Open command palette via keyboard shortcut simulation
    // or navigate to search -- triggering the command palette shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome to your workspace</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Workspace ID:{' '}
          <code className="rounded bg-background-elevated px-1 py-0.5 font-mono text-xs text-primary">
            {workspaceId}
          </code>
        </p>
        <p className="mt-1 text-sm text-foreground-muted">
          Select a note from the sidebar to get started.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleNewNote()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          New note
        </button>
        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center gap-2 rounded-md border border-border bg-background-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-hover"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z" />
          </svg>
          Search notes
        </button>
      </div>
    </div>
  );
}
