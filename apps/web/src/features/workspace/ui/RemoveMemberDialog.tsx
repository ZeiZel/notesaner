'use client';

/**
 * RemoveMemberDialog — confirmation dialog before removing a workspace member.
 *
 * Shows the member's name and email, warns about data implications,
 * and offers an optional "transfer ownership" path when removing the owner.
 *
 * Usage:
 *   <RemoveMemberDialog
 *     member={member}
 *     open={open}
 *     isPending={isPending}
 *     onConfirm={() => handleRemove(member.id)}
 *     onOpenChange={setOpen}
 *   />
 */

import type { WorkspaceMember } from '../model/members-store';
import { useFocusTrap } from '@/shared/lib/a11y';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RemoveMemberDialogProps {
  member: WorkspaceMember;
  open: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

// ─── Inline icons ──────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.553.553 0 01-1.1 0L7.1 4.995z" />
      <path
        fillRule="evenodd"
        d="M6.232 2.192a2 2 0 013.536 0l5.404 9.631A2 2 0 0113.404 15H2.596a2 2 0 01-1.768-3.177l5.404-9.631zM7.58 3.01a.5.5 0 01.884 0l5.404 9.631A.5.5 0 0113.404 14H2.596a.5.5 0 01-.442-.764L7.58 3.01z"
      />
    </svg>
  );
}

// ─── RemoveMemberDialog ────────────────────────────────────────────────────

export function RemoveMemberDialog({
  member,
  open,
  isPending,
  onConfirm,
  onOpenChange,
}: RemoveMemberDialogProps) {
  const focusTrapRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: () => {
      if (!isPending) onOpenChange(false);
    },
  });

  if (!open) return null;

  const handleBackdropClick = () => {
    if (!isPending) onOpenChange(false);
  };

  const handleCancel = () => {
    if (!isPending) onOpenChange(false);
  };

  return (
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-title"
      aria-describedby="remove-member-description"
      className="fixed inset-0 z-[var(--ns-z-modal)] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-floating">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="remove-member-title" className="text-base font-semibold text-foreground">
            Remove member
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="shrink-0 rounded-md p-1 text-foreground-muted hover:bg-background-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Warning icon + member info */}
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-destructive/5 p-3 border border-destructive/20">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p id="remove-member-description" className="text-sm font-medium text-foreground">
              Remove <span className="font-semibold">{member.user.displayName}</span>?
            </p>
            <p className="mt-0.5 text-xs text-foreground-secondary truncate">{member.user.email}</p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-5 text-sm text-foreground-secondary">
          This person will lose access to the workspace immediately. Their notes and contributions
          will remain in the workspace.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-destructive/50"
          >
            {isPending ? 'Removing...' : 'Remove member'}
          </button>
        </div>
      </div>
    </div>
  );
}
