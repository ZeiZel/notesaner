'use client';

/**
 * ShareLinkManager — manages public share links for a note.
 *
 * Features:
 *   - Create new share links with configurable permission, password, and expiration
 *   - Copy share link URL to clipboard
 *   - View existing link shares with access stats
 *   - Delete/revoke link shares
 *
 * Used inside ShareDialog on the "Share via link" tab.
 */

import { useState, useCallback } from 'react';
import type { NoteShareDto, SharePermission } from '@/shared/api/sharing';
import { copyText } from '@/shared/lib/clipboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareLinkManagerProps {
  linkShares: NoteShareDto[];
  isLoading: boolean;
  onCreateLink: (
    permission: SharePermission,
    password?: string,
    expiresAt?: string,
  ) => Promise<NoteShareDto | undefined>;
  onDeleteLink: (shareId: string) => void;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z" />
      <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 1a2 2 0 012 2v4H6V3a2 2 0 012-2zm3 6V3a3 3 0 00-6 0v4a2 2 0 00-2 2v5a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Permission options
// ---------------------------------------------------------------------------

const PERMISSION_OPTIONS: { value: SharePermission; label: string }[] = [
  { value: 'VIEW', label: 'View only' },
  { value: 'COMMENT', label: 'Can comment' },
  { value: 'EDIT', label: 'Can edit' },
];

// ---------------------------------------------------------------------------
// Expiration presets
// ---------------------------------------------------------------------------

const EXPIRATION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Never expires' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

function computeExpiresAt(preset: string): string | undefined {
  if (!preset) return undefined;

  const now = Date.now();
  const ms: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const duration = ms[preset];
  if (!duration) return undefined;

  return new Date(now + duration).toISOString();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getShareUrl(token: string): string {
  const base =
    typeof window !== 'undefined' ? `${window.location.origin}` : 'https://app.notesaner.com';
  return `${base}/share/${token}`;
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareLinkManager({
  linkShares,
  isLoading,
  onCreateLink,
  onDeleteLink,
}: ShareLinkManagerProps) {
  const [linkPermission, setLinkPermission] = useState<SharePermission>('VIEW');
  const [password, setPassword] = useState('');
  const [expirationPreset, setExpirationPreset] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreateLink = useCallback(async () => {
    setIsCreating(true);
    try {
      await onCreateLink(linkPermission, password || undefined, computeExpiresAt(expirationPreset));
      // Reset form after successful creation
      setPassword('');
      setExpirationPreset('');
    } finally {
      setIsCreating(false);
    }
  }, [linkPermission, password, expirationPreset, onCreateLink]);

  const handleCopyLink = useCallback(async (share: NoteShareDto) => {
    const url = getShareUrl(share.token);
    const success = await copyText(url);
    if (success) {
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Link creation form */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Create share link</h3>

        <div className="flex gap-2">
          <select
            value={linkPermission}
            onChange={(e) => setLinkPermission(e.target.value as SharePermission)}
            className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Link permission level"
          >
            {PERMISSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={expirationPreset}
            onChange={(e) => setExpirationPreset(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Link expiration"
          >
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Optional password protection"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => void handleCreateLink()}
            disabled={isCreating}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isCreating ? 'Creating...' : 'Create link'}
          </button>
        </div>
      </div>

      {/* Existing link shares */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-foreground-muted">Loading links...</div>
      ) : linkShares.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground-secondary uppercase tracking-wider">
            Active links
          </h3>
          {linkShares.map((share) => (
            <LinkShareRow
              key={share.id}
              share={share}
              isCopied={copiedId === share.id}
              onCopy={() => void handleCopyLink(share)}
              onDelete={() => onDeleteLink(share.id)}
            />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-foreground-muted">
          No share links created yet.
        </p>
      )}
    </div>
  );
}

ShareLinkManager.displayName = 'ShareLinkManager';

// ---------------------------------------------------------------------------
// LinkShareRow — single link share entry
// ---------------------------------------------------------------------------

function LinkShareRow({
  share,
  isCopied,
  onCopy,
  onDelete,
}: {
  share: NoteShareDto;
  isCopied: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const isExpired = share.expiresAt !== null && new Date(share.expiresAt) < new Date();

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
        isExpired
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border hover:bg-background-hover'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground-secondary">
            {share.permission.toLowerCase()}
          </span>
          {share.hasPassword && (
            <span
              className="flex items-center gap-1 text-xs text-foreground-muted"
              title="Password protected"
            >
              <LockIcon className="h-3 w-3" />
              protected
            </span>
          )}
          {isExpired && <span className="text-xs font-medium text-destructive">expired</span>}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-foreground-muted">
          <span>
            {share.accessCount} access{share.accessCount !== 1 ? 'es' : ''}
          </span>
          {share.expiresAt && !isExpired && <span>Expires: {formatDate(share.expiresAt)}</span>}
          <span>Created: {formatDate(share.createdAt)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCopy}
        title={isCopied ? 'Copied!' : 'Copy share link'}
        aria-label="Copy share link to clipboard"
        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-primary/10 hover:text-primary transition-colors"
      >
        {isCopied ? (
          <CheckIcon className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        title="Revoke share link"
        aria-label="Revoke share link"
        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
