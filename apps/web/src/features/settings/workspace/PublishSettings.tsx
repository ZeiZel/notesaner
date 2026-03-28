'use client';

/**
 * PublishSettings — public vault toggle, published notes, and custom domain.
 *
 * Composes:
 *   - Public vault on/off toggle
 *   - Public slug configuration
 *   - Published notes list with unpublish action
 *   - DomainSettings component (reused from features/publish/)
 *
 * Data is read from the workspace settings store. Domain config
 * is managed by the existing DomainSettings component + domain store.
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from './workspace-settings-store';
import { DomainSettings } from '@/features/publish/DomainSettings';
import type { PublishedNoteDto } from '@/shared/api/workspace-settings';

// ---------------------------------------------------------------------------
// PublishSettings
// ---------------------------------------------------------------------------

export function PublishSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);

  const settings = useWorkspaceSettingsStore((s) => s.settings);
  const publishedNotes = useWorkspaceSettingsStore((s) => s.publishedNotes);
  const isSaving = useWorkspaceSettingsStore((s) => s.isSaving);
  const updatePublish = useWorkspaceSettingsStore((s) => s.updatePublish);
  const fetchPublishedNotes = useWorkspaceSettingsStore((s) => s.fetchPublishedNotes);
  const unpublishNote = useWorkspaceSettingsStore((s) => s.unpublishNote);

  const [isPublic, setIsPublic] = useState(settings?.isPublic ?? false);
  const [publicSlug, setPublicSlug] = useState(settings?.publicSlug ?? '');
  const [slugError, setSlugError] = useState<string | null>(null);

  // Fetch published notes on mount (valid useEffect: data loading)
  useEffect(() => {
    if (!accessToken || !workspaceId) return;
    void fetchPublishedNotes(accessToken, workspaceId);
  }, [accessToken, workspaceId, fetchPublishedNotes]);

  // ---- Toggle public vault ----
  const handleTogglePublic = useCallback(async () => {
    if (!accessToken) return;
    const newValue = !isPublic;
    setIsPublic(newValue);
    try {
      await updatePublish(accessToken, workspaceId, { isPublic: newValue });
    } catch {
      setIsPublic(!newValue); // Rollback on error
    }
  }, [accessToken, workspaceId, isPublic, updatePublish]);

  // ---- Save public slug ----
  const handleSaveSlug = useCallback(async () => {
    const trimmed = publicSlug.trim();
    if (!trimmed) {
      setSlugError('Public slug is required when vault is public.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmed) && trimmed.length > 1) {
      setSlugError('Slug may only contain lowercase letters, numbers, and hyphens.');
      return;
    }
    setSlugError(null);

    if (!accessToken) return;
    try {
      await updatePublish(accessToken, workspaceId, { publicSlug: trimmed });
    } catch {
      // Error shown via store
    }
  }, [accessToken, workspaceId, publicSlug, updatePublish]);

  // ---- Unpublish note ----
  const handleUnpublish = useCallback(
    async (noteId: string) => {
      if (!accessToken) return;
      try {
        await unpublishNote(accessToken, workspaceId, noteId);
      } catch {
        // Error shown via store
      }
    },
    [accessToken, workspaceId, unpublishNote],
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Publish</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Configure public access, published notes, and custom domains.
        </p>
      </div>

      {/* Public vault toggle */}
      <section>
        <div className="flex items-center justify-between rounded-lg border border-border bg-background-surface p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Public vault</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              When enabled, notes marked as published will be accessible via a public URL.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label={isPublic ? 'Disable public vault' : 'Enable public vault'}
            disabled={isSaving}
            onClick={handleTogglePublic}
            className="relative inline-flex h-6 w-11 items-center rounded-full shrink-0 transition-colors disabled:opacity-50"
            style={{
              backgroundColor: isPublic ? 'var(--ns-color-primary)' : 'var(--ns-color-background)',
              border: `1px solid ${isPublic ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
            }}
          >
            <span
              className="inline-block h-4 w-4 rounded-full transition-transform"
              style={{
                backgroundColor: isPublic
                  ? 'var(--ns-color-primary-foreground)'
                  : 'var(--ns-color-foreground-muted)',
                transform: isPublic ? 'translateX(22px)' : 'translateX(3px)',
              }}
            />
          </button>
        </div>
      </section>

      {/* Public slug */}
      {isPublic && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-1">Public URL slug</h3>
          <p className="text-xs text-foreground-muted mb-3">
            Your vault will be accessible at{' '}
            <code className="rounded bg-background-surface px-1 py-0.5 text-xs text-primary">
              {publicSlug || 'your-slug'}.notesaner.app
            </code>
          </p>
          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              value={publicSlug}
              onChange={(e) => {
                setPublicSlug(e.target.value);
                if (slugError) setSlugError(null);
              }}
              placeholder="my-notes"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
              style={slugError ? { borderColor: 'var(--ns-color-destructive)' } : undefined}
            />
            <button
              type="button"
              onClick={handleSaveSlug}
              disabled={isSaving}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {slugError && (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {slugError}
            </p>
          )}
        </section>
      )}

      {/* Published notes */}
      {isPublic && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Published notes
            {publishedNotes.length > 0 && (
              <span className="ml-2 text-xs font-normal text-foreground-muted">
                ({publishedNotes.length})
              </span>
            )}
          </h3>

          {publishedNotes.length === 0 ? (
            <div className="rounded-lg border border-border py-8 text-center">
              <p className="text-sm text-foreground-muted">No notes are published yet.</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Open a note and toggle "Publish" in the note properties panel.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="hidden items-center gap-3 border-b border-border bg-background-surface px-4 py-2 text-xs font-medium text-foreground-secondary sm:flex">
                <div className="flex-1">Title</div>
                <div className="w-36 shrink-0">Published</div>
                <div className="w-16 shrink-0" />
              </div>

              {/* Rows */}
              {publishedNotes.map((note) => (
                <PublishedNoteRow
                  key={note.id}
                  note={note}
                  onUnpublish={() => handleUnpublish(note.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Custom domain */}
      {isPublic && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Custom domain</h3>
          <DomainSettings workspaceId={workspaceId} publicSlug={publicSlug || null} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PublishedNoteRow
// ---------------------------------------------------------------------------

function PublishedNoteRow({
  note,
  onUnpublish,
}: {
  note: PublishedNoteDto;
  onUnpublish: () => void;
}) {
  const publishedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(note.publishedAt));

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
      {/* Title + path */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
        <p className="text-xs text-foreground-muted truncate">{note.path}</p>
      </div>

      {/* Published date */}
      <div className="w-36 shrink-0 hidden sm:block">
        <span className="text-xs text-foreground-muted">{publishedDate}</span>
      </div>

      {/* Actions */}
      <div className="w-16 shrink-0 flex justify-end">
        <button
          type="button"
          onClick={onUnpublish}
          title="Unpublish note"
          className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
        >
          Unpublish
        </button>
      </div>
    </div>
  );
}
