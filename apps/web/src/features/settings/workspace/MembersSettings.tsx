'use client';

/**
 * MembersSettings — workspace member management tab.
 *
 * Reuses existing MembersList, InviteMemberForm, PendingInvitesSection,
 * and RemoveMemberDialog components from features/workspace/.
 *
 * Orchestrates fetching, invite, role change, and remove actions
 * via the members-store Zustand store. No useEffect for data sync --
 * one fetch on mount via the store, all mutations are event-driven.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  useMembersStore,
  selectSortedMembers,
  canManageMembers,
  type WorkspaceMember,
  type MemberRole,
  type InviteMemberPayload,
} from '@/features/workspace/members-store';
import { MembersList } from '@/features/workspace/MembersList';
import { InviteMemberForm } from '@/features/workspace/InviteMemberForm';
import { PendingInvitesSection } from '@/features/workspace/PendingInvitesSection';
import { RemoveMemberDialog } from '@/features/workspace/RemoveMemberDialog';
import { InlineSpinner } from '@/shared/lib/skeletons';

// ---------------------------------------------------------------------------
// MembersSettings
// ---------------------------------------------------------------------------

export function MembersSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);

  // Members store
  const members = useMembersStore((s) => s.members);
  const pendingInvites = useMembersStore((s) => s.pendingInvites);
  const isLoading = useMembersStore((s) => s.isLoading);
  const error = useMembersStore((s) => s.error);
  const fetchMembers = useMembersStore((s) => s.fetchMembers);
  const fetchInvitations = useMembersStore((s) => s.fetchInvitations);
  const inviteMember = useMembersStore((s) => s.inviteMember);
  const changeRole = useMembersStore((s) => s.changeRole);
  const removeMember = useMembersStore((s) => s.removeMember);
  const resendInvite = useMembersStore((s) => s.resendInvite);
  const cancelInvite = useMembersStore((s) => s.cancelInvite);
  const clearError = useMembersStore((s) => s.clearError);

  // Local UI state
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemovePending, setIsRemovePending] = useState(false);

  // Derive current user role from members list
  const currentMember = members.find((m) => m.userId === currentUser?.id);
  const currentUserRole: MemberRole | null = currentMember?.role ?? null;
  const sortedMembers = selectSortedMembers(members);

  // ---- Fetch data on mount (valid useEffect: data loading on mount) ----
  useEffect(() => {
    if (!accessToken || !workspaceId) return;

    void fetchMembers(accessToken, workspaceId);
    void fetchInvitations(accessToken, workspaceId);
  }, [accessToken, workspaceId, fetchMembers, fetchInvitations]);

  // ---- Invite handler ----
  const handleInvite = useCallback(
    async (payload: InviteMemberPayload) => {
      if (!accessToken) return;
      setIsInviting(true);
      setInviteError(null);
      try {
        await inviteMember(accessToken, workspaceId, payload);
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
      } finally {
        setIsInviting(false);
      }
    },
    [accessToken, workspaceId, inviteMember],
  );

  // ---- Role change handler ----
  const handleChangeRole = useCallback(
    async (memberId: string, newRole: MemberRole) => {
      if (!accessToken) return;
      try {
        await changeRole(accessToken, workspaceId, memberId, newRole);
      } catch {
        // Error displayed via store
      }
    },
    [accessToken, workspaceId, changeRole],
  );

  // ---- Remove member flow ----
  const handleRemoveClick = useCallback((member: WorkspaceMember) => {
    setRemoveTarget(member);
    setIsRemoveDialogOpen(true);
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!accessToken || !removeTarget) return;

    setIsRemovePending(true);
    setRemovingIds((prev) => new Set([...prev, removeTarget.id]));

    try {
      await removeMember(accessToken, workspaceId, removeTarget.id);
      setIsRemoveDialogOpen(false);
      setRemoveTarget(null);
    } catch {
      // Error displayed via store
    } finally {
      setIsRemovePending(false);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(removeTarget.id);
        return next;
      });
    }
  }, [accessToken, workspaceId, removeTarget, removeMember]);

  // ---- Invite management handlers ----
  const handleResendInvite = useCallback(
    async (inviteId: string) => {
      if (!accessToken) return;
      setResendingIds((prev) => new Set([...prev, inviteId]));
      try {
        await resendInvite(accessToken, workspaceId, inviteId);
      } catch {
        // Error displayed via store
      } finally {
        setResendingIds((prev) => {
          const next = new Set(prev);
          next.delete(inviteId);
          return next;
        });
      }
    },
    [accessToken, workspaceId, resendInvite],
  );

  const handleCancelInvite = useCallback(
    async (inviteId: string) => {
      if (!accessToken) return;
      setCancelingIds((prev) => new Set([...prev, inviteId]));
      try {
        await cancelInvite(accessToken, workspaceId, inviteId);
      } catch {
        // Error displayed via store
      } finally {
        setCancelingIds((prev) => {
          const next = new Set(prev);
          next.delete(inviteId);
          return next;
        });
      }
    },
    [accessToken, workspaceId, cancelInvite],
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Members</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage workspace members, invitations, and roles.
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

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <InlineSpinner />
        </div>
      ) : (
        <>
          {/* Members list */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Members
              <span className="ml-2 text-xs font-normal text-foreground-muted">
                ({sortedMembers.length})
              </span>
            </h3>
            <MembersList
              members={sortedMembers}
              currentUserId={currentUser?.id ?? ''}
              currentUserRole={currentUserRole}
              removingIds={removingIds}
              onChangeRole={handleChangeRole}
              onRemove={handleRemoveClick}
            />
          </section>

          {/* Pending invitations */}
          <PendingInvitesSection
            invites={pendingInvites}
            resendingIds={resendingIds}
            cancelingIds={cancelingIds}
            onResend={handleResendInvite}
            onCancel={handleCancelInvite}
          />

          {/* Invite form */}
          {canManageMembers(currentUserRole) && (
            <InviteMemberForm
              isPending={isInviting}
              serverError={inviteError}
              onInvite={handleInvite}
            />
          )}
        </>
      )}

      {/* Remove confirmation dialog */}
      {removeTarget && (
        <RemoveMemberDialog
          member={removeTarget}
          open={isRemoveDialogOpen}
          isPending={isRemovePending}
          onConfirm={handleRemoveConfirm}
          onOpenChange={(open) => {
            setIsRemoveDialogOpen(open);
            if (!open) setRemoveTarget(null);
          }}
        />
      )}
    </div>
  );
}
