import type { Metadata } from 'next';
import { NoteEditorClient } from './NoteEditorClient';

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
 * then passes data down to the NoteEditorClient Client Component.
 *
 * The actual editor surface is determined by the active editor mode
 * (WYSIWYG, Source, Live Preview, or Reading) via EditorModeWrapper.
 */
export default async function NotePage({ params }: NotePageProps) {
  const { workspaceId, noteId } = await params;

  return <NoteEditorClient workspaceId={workspaceId} noteId={noteId} />;
}
