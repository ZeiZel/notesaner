'use client';

/**
 * PendingInvitesSection — list of pending workspace invitations.
 *
 * Features:
 *   - Shows email, role badge, invite date, expiry
 *   - Resend invite email button
 *   - Cancel invite button
 *   - Copy invite link (when token is available)
 *   - Empty state
 *
 * Usage:
 *   <PendingInvitesSection
 *     invites={pendingInvites}
 *     onResend={(inviteId) => handleResend(inviteId)}
 *     onCancel={(inviteId) => handleCancel(inviteId)}
 *   />
 */

import { useState } from 'react';
import type { PendingInvitation } from './members-store';
import { RoleBadge } from './RoleBadge';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PendingInvitesSectionProps {
  invites: PendingInvitation[];
  resendingIds: Set<string>;
  cancelingIds: Set<string>;
  onResend: (inviteId: string) => void;
  onCancel: (inviteId: string) => void;
}

// ─── Date formatting ───────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(isoString));
}

function isExpiringSoon(expiresAt: string): boolean {
  const msRemaining = new Date(expiresAt).getTime() - Date.now();
  return msRemaining > 0 && msRemaining < 24 * 60 * 60 * 1000; // < 24 hours
}

// ─── Inline icons ──────────────────────────────────────────────────────────

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M0 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v.217l7 4.2 7-4.2V4a1 1 0 00-1-1H2zm13 2.383l-4.758 2.855L15 11.114V5.383zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 002 13h12a1 1 0 00.966-.739zM1 11.114l4.758-2.876L1 5.383v5.731z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 2a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1H6zM2 5a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-1h1v1a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h1v1H2z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

// ─── Invite row ────────────────────────────────────────────────────────────

interface InviteRowProps {
  invite: PendingInvitation;
  isResending: boolean;
  isCanceling: boolean;
  onResend: () => void;
  onCancel: () => void;
}

function InviteRow({ invite, isResending, isCanceling, onResend, onCancel }: InviteRowProps) {
  const [copied, setCopied] = useState(false);
  const expiringSoon = isExpiringSoon(invite.expiresAt);

  const handleCopyLink = async () => {
    if (!invite.token) return;
    const url = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div
      data-testid={`invite-row-${invite.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background-surface px-4 py-3"
    >
      {/* Mail icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5">
        <MailIcon className="h-4 w-4 text-foreground-secondary" />
      </div>

      {/* Email + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">{invite.email}</span>
          <RoleBadge role={invite.role} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground-muted">
          <span>Invited {formatDate(invite.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span className={expiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
            Expires {formatDate(invite.expiresAt)}
            {expiringSoon && ' (soon)'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Copy invite link */}
        {invite.token && (
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            title="Copy invite link"
            aria-label="Copy invite link"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          >
            {copied ? (
              <span className="text-xs font-medium text-primary">OK</span>
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Resend button */}
        <button
          type="button"
          onClick={onResend}
          disabled={isResending || isCanceling}
          title="Resend invitation email"
          aria-label={`Resend invitation to ${invite.email}`}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground-secondary hover:bg-background-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 transition-colors"
        >
          {isResending ? 'Sending...' : 'Resend'}
        </button>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isResending || isCanceling}
          title="Cancel invitation"
          aria-label={`Cancel invitation for ${invite.email}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 transition-colors"
        >
          {isCanceling ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
          ) : (
            <XIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── PendingInvitesSection ─────────────────────────────────────────────────

export function PendingInvitesSection({
  invites,
  resendingIds,
  cancelingIds,
  onResend,
  onCancel,
}: PendingInvitesSectionProps) {
  if (invites.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="pending-invites-heading">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="pending-invites-heading" className="text-sm font-semibold text-foreground">
          Pending invitations
          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            {invites.length}
          </span>
        </h3>
      </div>

      <div className="space-y-2" role="list" aria-label="Pending invitations">
        {invites.map((invite) => (
          <div key={invite.id} role="listitem">
            <InviteRow
              invite={invite}
              isResending={resendingIds.has(invite.id)}
              isCanceling={cancelingIds.has(invite.id)}
              onResend={() => onResend(invite.id)}
              onCancel={() => onCancel(invite.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
