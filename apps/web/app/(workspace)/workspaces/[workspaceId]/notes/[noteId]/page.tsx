import type { Metadata } from 'next';
import { NoteEditorPage } from '@/pages/note-editor';

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
 * Note editor route — thin wrapper that delegates to NoteEditorPage composition.
 */
export default async function NoteRoute({ params }: NotePageProps) {
  const { workspaceId, noteId } = await params;

  return <NoteEditorPage workspaceId={workspaceId} noteId={noteId} />;
}
