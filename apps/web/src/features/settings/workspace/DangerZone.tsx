'use client';

/**
 * DangerZone — destructive workspace actions.
 *
 * Features:
 *   - Transfer ownership to another admin member
 *   - Delete workspace with type-to-confirm guard
 *
 * Both actions require explicit confirmation. Delete requires typing
 * the workspace name exactly. No useEffect -- all state is local
 * and event-driven.
 */

import { useState, useCallback, useId } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from './workspace-settings-store';
import { useMembersStore, type WorkspaceMember } from '@/features/workspace/members-store';

// ---------------------------------------------------------------------------
// DangerZone
// ---------------------------------------------------------------------------

export function DangerZone() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const settings = useWorkspaceSettingsStore((s) => s.settings);
  const isSaving = useWorkspaceSettingsStore((s) => s.isSaving);
  const error = useWorkspaceSettingsStore((s) => s.error);
  const transferOwnership = useWorkspaceSettingsStore((s) => s.transferOwnership);
  const deleteWorkspace = useWorkspaceSettingsStore((s) => s.deleteWorkspace);
  const clearError = useWorkspaceSettingsStore((s) => s.clearError);

  const members = useMembersStore((s) => s.members);
  const currentUser = useAuthStore((s) => s.user);

  const workspaceName = settings?.name ?? '';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Irreversible actions. Proceed with caution.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="text-xs text-destructive hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Transfer ownership */}
      <TransferOwnershipSection
        workspaceId={workspaceId}
        accessToken={accessToken}
        currentUserId={currentUser?.id ?? ''}
        members={members}
        isSaving={isSaving}
        onTransfer={transferOwnership}
      />

      {/* Delete workspace */}
      <DeleteWorkspaceSection
        workspaceName={workspaceName}
        isSaving={isSaving}
        onDelete={async () => {
          if (!accessToken) return;
          await deleteWorkspace(accessToken, workspaceId);
          router.replace('/workspaces');
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransferOwnershipSection
// ---------------------------------------------------------------------------

function TransferOwnershipSection({
  workspaceId,
  accessToken,
  currentUserId,
  members,
  isSaving,
  onTransfer,
}: {
  workspaceId: string;
  accessToken: string | null;
  currentUserId: string;
  members: WorkspaceMember[];
  isSaving: boolean;
  onTransfer: (token: string, wsId: string, newOwnerId: string) => Promise<void>;
}) {
  const selectId = useId();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Only ADMIN and OWNER members (excluding current user) can receive ownership
  const eligibleMembers = members.filter(
    (m) => m.userId !== currentUserId && (m.role === 'ADMIN' || m.role === 'OWNER'),
  );

  const handleTransfer = useCallback(async () => {
    if (!accessToken || !selectedMemberId) return;
    setIsPending(true);
    try {
      await onTransfer(accessToken, workspaceId, selectedMemberId);
      setShowConfirm(false);
      setSelectedMemberId('');
    } catch {
      // Error shown via store
    } finally {
      setIsPending(false);
    }
  }, [accessToken, workspaceId, selectedMemberId, onTransfer]);

  return (
    <section className="rounded-lg border border-amber-500/50 p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">Transfer ownership</h3>
      <p className="text-xs text-foreground-muted mb-4">
        Transfer workspace ownership to another admin member. You will be demoted to Admin role
        after the transfer.
      </p>

      {eligibleMembers.length === 0 ? (
        <p className="text-xs text-foreground-muted">
          No eligible members to transfer ownership to. Add another admin first.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1">
              <label
                htmlFor={selectId}
                className="mb-1 block text-xs font-medium text-foreground-secondary"
              >
                New owner
              </label>
              <select
                id={selectId}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                disabled={isSaving || isPending}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select a member...</option>
                {eligibleMembers.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.user.displayName} ({m.user.email})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={!selectedMemberId || isSaving || isPending}
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 transition-colors dark:text-amber-300"
            >
              Transfer
            </button>
          </div>

          {/* Confirmation dialog */}
          {showConfirm && (
            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-foreground mb-3">
                Are you sure you want to transfer ownership? This action cannot be undone by you --
                only the new owner can transfer it back.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isPending}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Transferring...' : 'Confirm transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={isPending}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DeleteWorkspaceSection
// ---------------------------------------------------------------------------

function DeleteWorkspaceSection({
  workspaceName,
  isSaving,
  onDelete,
}: {
  workspaceName: string;
  isSaving: boolean;
  onDelete: () => Promise<void>;
}) {
  const inputId = useId();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const isConfirmed = confirmText === workspaceName;

  const handleDelete = useCallback(async () => {
    if (!isConfirmed) return;
    setIsPending(true);
    try {
      await onDelete();
    } catch {
      // Error shown via store
    } finally {
      setIsPending(false);
    }
  }, [isConfirmed, onDelete]);

  return (
    <section className="rounded-lg border border-destructive p-6">
      <h3 className="text-sm font-semibold text-destructive mb-1">Delete workspace</h3>
      <p className="text-xs text-foreground-muted mb-2">
        Permanently delete this workspace, all its notes, member associations, and published
        content. This action is irreversible.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isSaving}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          Delete this workspace
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3 mb-3">
              <svg
                viewBox="0 0 16 16"
                className="h-5 w-5 mt-0.5 shrink-0 text-destructive"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7.002 11a1 1 0 112 0 1 1 0 01-2 0zM7.1 4.995a.905.905 0 111.8 0l-.35 3.507a.553.553 0 01-1.1 0L7.1 4.995z" />
                <path
                  fillRule="evenodd"
                  d="M6.232 2.192a2 2 0 013.536 0l5.404 9.631A2 2 0 0113.404 15H2.596a2 2 0 01-1.768-3.177l5.404-9.631zM7.58 3.01a.5.5 0 01.884 0l5.404 9.631A.5.5 0 0113.404 14H2.596a.5.5 0 01-.442-.764L7.58 3.01z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-foreground">
                  This will permanently delete the workspace
                </p>
                <p className="text-xs text-foreground-secondary mt-1">
                  All notes, files, and member data will be lost forever. Published content will
                  become inaccessible immediately.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor={inputId} className="block text-sm text-foreground">
                Type{' '}
                <code className="rounded bg-background px-1 py-0.5 text-xs font-mono font-semibold text-destructive">
                  {workspaceName}
                </code>{' '}
                to confirm:
              </label>
              <input
                id={inputId}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={workspaceName}
                autoComplete="off"
                spellCheck={false}
                disabled={isPending}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-destructive/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isPending || isSaving}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Deleting...' : 'I understand, delete this workspace'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
