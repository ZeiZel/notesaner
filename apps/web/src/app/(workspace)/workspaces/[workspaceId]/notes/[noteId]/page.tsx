import type { Metadata } from 'next';

interface NotePageProps {
  params: Promise<{ workspaceId: string; noteId: string }>;
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { noteId } = await params;
  return {
    title: `Note ${noteId}`,
  };
}

/**
 * Note editor page.
 *
 * Server Component wrapper — fetches note metadata server-side,
 * then passes data down to the NoteEditor Client Component (TipTap).
 *
 * The actual TipTap editor is a 'use client' component in features/editor.
 */
export default async function NotePage({ params }: NotePageProps) {
  const { workspaceId, noteId } = await params;

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb toolbar */}
      <div className="flex h-11 items-center border-b border-border px-4">
        <nav aria-label="Note path" className="flex items-center gap-1 text-xs text-foreground-secondary">
          <span>Workspace</span>
          <span>/</span>
          <span className="text-foreground">Untitled note</span>
        </nav>
      </div>

      {/* Editor area placeholder */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto py-12">
        <div className="w-full max-w-prose px-6">
          <p className="text-xs text-foreground-muted">
            workspaceId: {workspaceId} / noteId: {noteId}
          </p>
          <h1
            className="mt-4 text-4xl font-bold text-foreground outline-none"
            data-placeholder="Untitled"
            suppressContentEditableWarning
            contentEditable
          >
          </h1>
          <div className="mt-6 text-base text-foreground-secondary">
            TipTap editor will render here. (features/editor/NoteEditor.tsx)
          </div>
        </div>
      </div>
    </div>
  );
}
