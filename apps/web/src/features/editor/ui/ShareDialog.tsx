'use client';

/**
 * ShareDialog — modal for sharing a note with users or via link.
 *
 * Features:
 *   - Share by email with permission selection (view/comment/edit)
 *   - Generate public share links with optional password and expiration
 *   - View and manage existing shares
 *   - Copy share link to clipboard
 *
 * Usage:
 *   <ShareDialog
 *     open={isShareOpen}
 *     onClose={() => setShareOpen(false)}
 *     noteId={activeNoteId}
 *     noteTitle={noteTitle}
 *     workspaceId={activeWorkspaceId}
 *   />
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { sharingApi } from '@/shared/api/sharing';
import type { NoteShareDto, SharePermission, CreateSharePayload } from '@/shared/api/sharing';
import { ShareLinkManager } from './ShareLinkManager';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

const shareKeys = {
  all: ['shares'] as const,
  list: (workspaceId: string, noteId: string) =>
    [...shareKeys.all, 'list', workspaceId, noteId] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  workspaceId: string;
}

type ShareTab = 'email' | 'link';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.5 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm.5-5v1.5H14.5a.5.5 0 010 1H13V15a.5.5 0 01-1 0v-1.5H10.5a.5.5 0 010-1H12V11a.5.5 0 011 0z" />
      <path d="M2 1a2 2 0 00-2 2v10a2 2 0 002 2h4.5a.5.5 0 000-1H2a1 1 0 01-1-1V3a1 1 0 011-1h12a1 1 0 011 1v4.5a.5.5 0 001 0V3a2 2 0 00-2-2H2z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6.354 5.5H4a3 3 0 000 6h3a3 3 0 002.83-4H9.4a2 2 0 01-1.4.584H4a2 2 0 110-4h2.354a4.003 4.003 0 010-1.584zM9.646 10.5H12a3 3 0 000-6H9a3 3 0 00-2.83 4H6.6A2 2 0 018 7.416H12a2 2 0 110 4H9.646a4.003 4.003 0 010 1.084z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Permission options
// ---------------------------------------------------------------------------

const PERMISSION_OPTIONS: { value: SharePermission; label: string; description: string }[] = [
  { value: 'VIEW', label: 'View', description: 'Can read the note' },
  { value: 'COMMENT', label: 'Comment', description: 'Can read and comment' },
  { value: 'EDIT', label: 'Edit', description: 'Can read, comment, and edit' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareDialog({ open, onClose, noteId, noteTitle, workspaceId }: ShareDialogProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ShareTab>('email');
  const [error, setError] = useState<string | null>(null);

  // Email share form state
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [isSending, setIsSending] = useState(false);

  // Fetch shares via TanStack Query (replaces useEffect + manual fetch)
  const { data: shares = [], isLoading } = useQuery({
    queryKey: shareKeys.list(workspaceId, noteId),
    queryFn: () => sharingApi.listShares(accessToken ?? '', workspaceId, noteId),
    enabled: open && !!accessToken,
  });

  /** Invalidate the shares cache after a mutation. */
  const invalidateShares = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: shareKeys.list(workspaceId, noteId) });
  }, [queryClient, workspaceId, noteId]);

  // Handle email share submission
  const handleEmailShare = useCallback(async () => {
    if (!accessToken || !email.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const payload: CreateSharePayload = {
        type: 'email',
        email: email.trim(),
        permission,
      };

      await sharingApi.createShare(accessToken, workspaceId, noteId, payload);
      invalidateShares();
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share note');
    } finally {
      setIsSending(false);
    }
  }, [accessToken, email, permission, workspaceId, noteId, invalidateShares]);

  // Handle link share creation
  const handleCreateLink = useCallback(
    async (linkPermission: SharePermission, password?: string, expiresAt?: string) => {
      if (!accessToken) return;

      setError(null);

      try {
        const payload: CreateSharePayload = {
          type: 'link',
          permission: linkPermission,
          password: password || null,
          expiresAt: expiresAt || null,
        };

        const newShare = await sharingApi.createShare(accessToken, workspaceId, noteId, payload);
        invalidateShares();
        return newShare;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create share link');
        return undefined;
      }
    },
    [accessToken, workspaceId, noteId, invalidateShares],
  );

  // Handle share deletion
  const handleDeleteShare = useCallback(
    async (shareId: string) => {
      if (!accessToken) return;

      try {
        await sharingApi.deleteShare(accessToken, workspaceId, noteId, shareId);
        invalidateShares();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke share');
      }
    },
    [accessToken, workspaceId, noteId, invalidateShares],
  );

  if (!open) return null;

  const emailShares = shares.filter((s) => s.sharedWith !== null);
  const linkShares = shares.filter((s) => s.sharedWith === null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Share "${noteTitle}"`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Share note</h2>
            <p className="text-sm text-foreground-muted truncate max-w-[320px]">{noteTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-background-hover transition-colors"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'email'
                ? 'border-b-2 border-primary text-primary'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <UserPlusIcon className="h-4 w-4" />
            Share with people
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'link'
                ? 'border-b-2 border-primary text-primary'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <LinkIcon className="h-4 w-4" />
            Share via link
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Tab content */}
        <div className="px-6 py-4">
          {activeTab === 'email' ? (
            <div className="space-y-4">
              {/* Email input row */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleEmailShare();
                  }}
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as SharePermission)}
                  className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Permission level"
                >
                  {PERMISSION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleEmailShare()}
                  disabled={!email.trim() || isSending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isSending ? 'Sharing...' : 'Share'}
                </button>
              </div>

              {/* Existing email shares */}
              {isLoading ? (
                <div className="py-4 text-center text-sm text-foreground-muted">
                  Loading shares...
                </div>
              ) : emailShares.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                    Shared with
                  </h3>
                  {emailShares.map((share) => (
                    <ShareRow
                      key={share.id}
                      share={share}
                      onDelete={() => void handleDeleteShare(share.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-foreground-muted">
                  Not shared with anyone yet.
                </p>
              )}
            </div>
          ) : (
            <ShareLinkManager
              linkShares={linkShares}
              isLoading={isLoading}
              onCreateLink={handleCreateLink}
              onDeleteLink={(shareId) => void handleDeleteShare(shareId)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

ShareDialog.displayName = 'ShareDialog';

// ---------------------------------------------------------------------------
// ShareRow — single email share entry
// ---------------------------------------------------------------------------

function ShareRow({ share, onDelete }: { share: NoteShareDto; onDelete: () => void }) {
  const initials = (share.sharedWithName ?? share.sharedWithEmail ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => (p[0] ?? '').toUpperCase())
    .join('');

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-background-hover transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary select-none">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {share.sharedWithName ?? share.sharedWithEmail}
        </p>
        {share.sharedWithName && share.sharedWithEmail && (
          <p className="text-xs text-foreground-muted truncate">{share.sharedWithEmail}</p>
        )}
      </div>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground-secondary">
        {share.permission.toLowerCase()}
      </span>
      <button
        type="button"
        onClick={onDelete}
        title="Revoke share"
        aria-label={`Revoke share for ${share.sharedWithName ?? share.sharedWithEmail}`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
