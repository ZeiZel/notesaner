'use client';

/**
 * PublishSettings -- public vault toggle, published notes, and custom domain.
 *
 * Styled with Ant Design Switch, Button, Input, Typography, Card, Table, Empty.
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Switch, Button, Input, Typography, Card, Empty, Space } from 'antd';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
import { DomainSettings } from '@/features/publish';
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

  const handleTogglePublic = useCallback(async () => {
    if (!accessToken) return;
    const newValue = !isPublic;
    setIsPublic(newValue);
    try {
      await updatePublish(accessToken, workspaceId, { isPublic: newValue });
    } catch {
      setIsPublic(!newValue);
    }
  }, [accessToken, workspaceId, isPublic, updatePublish]);

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
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Page header */}
      <Box>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          Publish
        </Typography.Title>
        <Typography.Text type="secondary">
          Configure public access, published notes, and custom domains.
        </Typography.Text>
      </Box>

      {/* Public vault toggle */}
      <Box as="section">
        <Card size="small">
          <Box className="flex items-center justify-between">
            <Box>
              <Typography.Text strong style={{ fontSize: 14 }}>
                Public vault
              </Typography.Text>
              <Typography.Text
                type="secondary"
                style={{ display: 'block', fontSize: 12, marginTop: 2 }}
              >
                When enabled, notes marked as published will be accessible via a public URL.
              </Typography.Text>
            </Box>
            <Switch
              checked={isPublic}
              loading={isSaving}
              onChange={handleTogglePublic}
              aria-label={isPublic ? 'Disable public vault' : 'Enable public vault'}
            />
          </Box>
        </Card>
      </Box>

      {/* Public slug */}
      {isPublic && (
        <Box as="section">
          <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
            Public URL slug
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginBottom: 12, fontSize: 12 }}
          >
            Your vault will be accessible at{' '}
            <Typography.Text code>{publicSlug || 'your-slug'}.notesaner.app</Typography.Text>
          </Typography.Text>
          <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
            <Input
              value={publicSlug}
              onChange={(e) => {
                setPublicSlug(e.target.value);
                if (slugError) setSlugError(null);
              }}
              placeholder="my-notes"
              style={{ fontFamily: 'monospace' }}
              status={slugError ? 'error' : undefined}
            />
            <Button type="primary" onClick={handleSaveSlug} loading={isSaving}>
              Save
            </Button>
          </Space.Compact>
          {slugError && (
            <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {slugError}
            </Typography.Text>
          )}
        </Box>
      )}

      {/* Published notes */}
      {isPublic && (
        <Box as="section">
          <Typography.Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
            Published notes
            {publishedNotes.length > 0 && (
              <Typography.Text
                type="secondary"
                style={{ marginLeft: 8, fontWeight: 'normal', fontSize: 12 }}
              >
                ({publishedNotes.length})
              </Typography.Text>
            )}
          </Typography.Text>

          {publishedNotes.length === 0 ? (
            <Card>
              <Empty description="No notes are published yet.">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Open a note and toggle "Publish" in the note properties panel.
                </Typography.Text>
              </Empty>
            </Card>
          ) : (
            <Card size="small" styles={{ body: { padding: 0 } }}>
              {publishedNotes.map((note) => (
                <PublishedNoteRow
                  key={note.id}
                  note={note}
                  onUnpublish={() => handleUnpublish(note.id)}
                />
              ))}
            </Card>
          )}
        </Box>
      )}

      {/* Custom domain */}
      {isPublic && (
        <Box as="section">
          <Typography.Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
            Custom domain
          </Typography.Text>
          <DomainSettings workspaceId={workspaceId} publicSlug={publicSlug || null} />
        </Box>
      )}
    </Box>
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
    <Box
      className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      <Box className="flex-1 min-w-0">
        <Typography.Text strong style={{ fontSize: 14 }} ellipsis>
          {note.title}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis>
          {note.path}
        </Typography.Text>
      </Box>
      <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
        {publishedDate}
      </Typography.Text>
      <Button type="text" danger size="small" onClick={onUnpublish}>
        Unpublish
      </Button>
    </Box>
  );
}
