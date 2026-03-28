/**
 * members-store.ts
 *
 * Zustand store for workspace member management.
 *
 * Responsibilities:
 *   - Track workspace members with their roles and activity
 *   - Track pending invitations
 *   - Expose async actions that call the backend API
 *   - Provide loading and error states per operation
 *
 * Design notes:
 *   - Store is NOT persisted — member data is always fresh from server.
 *   - Actions are async and update optimistically where safe.
 *   - Error strings are human-readable for display in the UI.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '@/shared/api/client';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface MemberUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  lastActiveAt: string | null;
  user: MemberUser;
}

export interface PendingInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  /** Invite token for building the invite link */
  token?: string;
}

export interface InviteMemberPayload {
  email: string;
  role: MemberRole;
}

// ─── Store State & Actions ──────────────────────────────────────────────────

interface MembersStoreState {
  // ---- State ----

  members: WorkspaceMember[];
  pendingInvites: PendingInvitation[];
  isLoading: boolean;
  error: string | null;

  // ---- Actions ----

  /**
   * Fetch workspace members from the API.
   * Replaces the current members list.
   */
  fetchMembers: (token: string, workspaceId: string) => Promise<void>;

  /**
   * Fetch pending invitations for the workspace.
   */
  fetchInvitations: (token: string, workspaceId: string) => Promise<void>;

  /**
   * Invite a new member by email with the given role.
   * Appends the resulting invitation to pendingInvites on success.
   */
  inviteMember: (
    token: string,
    workspaceId: string,
    payload: InviteMemberPayload,
  ) => Promise<PendingInvitation>;

  /**
   * Change the role of an existing member.
   * Updates the member in-place optimistically.
   */
  changeRole: (
    token: string,
    workspaceId: string,
    memberId: string,
    newRole: MemberRole,
  ) => Promise<void>;

  /**
   * Remove a member from the workspace.
   * Removes from the local list immediately.
   */
  removeMember: (token: string, workspaceId: string, memberId: string) => Promise<void>;

  /**
   * Resend the invitation email for a pending invite.
   * Updates the invite's expiresAt on success.
   */
  resendInvite: (token: string, workspaceId: string, inviteId: string) => Promise<void>;

  /**
   * Cancel a pending invitation.
   * Removes it from pendingInvites immediately.
   */
  cancelInvite: (token: string, workspaceId: string, inviteId: string) => Promise<void>;

  /** Clear any error message. */
  clearError: () => void;
}

// ─── Store Implementation ──────────────────────────────────────────────────

export const useMembersStore = create<MembersStoreState>()(
  devtools(
    (set, get) => ({
      // ---- Initial state ----

      members: [],
      pendingInvites: [],
      isLoading: false,
      error: null,

      // ---- Actions ----

      fetchMembers: async (token, workspaceId) => {
        set({ isLoading: true, error: null }, false, 'members/fetchMembers/start');
        try {
          const members = await apiClient.get<WorkspaceMember[]>(
            `/api/workspaces/${workspaceId}/members`,
            { token },
          );
          set({ members, isLoading: false }, false, 'members/fetchMembers/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load members';
          set({ error: message, isLoading: false }, false, 'members/fetchMembers/error');
          throw err;
        }
      },

      fetchInvitations: async (token, workspaceId) => {
        try {
          const invitations = await apiClient.get<PendingInvitation[]>(
            `/api/workspaces/${workspaceId}/invitations`,
            { token },
          );
          set({ pendingInvites: invitations }, false, 'members/fetchInvitations/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load invitations';
          set({ error: message }, false, 'members/fetchInvitations/error');
          throw err;
        }
      },

      inviteMember: async (token, workspaceId, payload) => {
        try {
          const invitation = await apiClient.post<PendingInvitation>(
            `/api/workspaces/${workspaceId}/invitations`,
            payload,
            { token },
          );
          set(
            (state) => ({
              pendingInvites: [...state.pendingInvites, invitation],
            }),
            false,
            'members/inviteMember/success',
          );
          return invitation;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to send invitation';
          set({ error: message }, false, 'members/inviteMember/error');
          throw err;
        }
      },

      changeRole: async (token, workspaceId, memberId, newRole) => {
        // Optimistic update
        const previousMembers = get().members;
        set(
          (state) => ({
            members: state.members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
          }),
          false,
          'members/changeRole/optimistic',
        );

        try {
          await apiClient.patch(
            `/api/workspaces/${workspaceId}/members/${memberId}`,
            { role: newRole },
            { token },
          );
        } catch (err) {
          // Rollback optimistic update on failure
          set({ members: previousMembers }, false, 'members/changeRole/rollback');
          const message = err instanceof Error ? err.message : 'Failed to change role';
          set({ error: message }, false, 'members/changeRole/error');
          throw err;
        }
      },

      removeMember: async (token, workspaceId, memberId) => {
        // Optimistic removal
        const previousMembers = get().members;
        set(
          (state) => ({
            members: state.members.filter((m) => m.id !== memberId),
          }),
          false,
          'members/removeMember/optimistic',
        );

        try {
          await apiClient.delete(`/api/workspaces/${workspaceId}/members/${memberId}`, { token });
        } catch (err) {
          // Rollback on failure
          set({ members: previousMembers }, false, 'members/removeMember/rollback');
          const message = err instanceof Error ? err.message : 'Failed to remove member';
          set({ error: message }, false, 'members/removeMember/error');
          throw err;
        }
      },

      resendInvite: async (token, workspaceId, inviteId) => {
        try {
          const updated = await apiClient.post<PendingInvitation>(
            `/api/workspaces/${workspaceId}/invitations/${inviteId}/resend`,
            {},
            { token },
          );
          set(
            (state) => ({
              pendingInvites: state.pendingInvites.map((inv) =>
                inv.id === inviteId ? { ...inv, expiresAt: updated.expiresAt } : inv,
              ),
            }),
            false,
            'members/resendInvite/success',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to resend invite';
          set({ error: message }, false, 'members/resendInvite/error');
          throw err;
        }
      },

      cancelInvite: async (token, workspaceId, inviteId) => {
        // Optimistic removal
        const previousInvites = get().pendingInvites;
        set(
          (state) => ({
            pendingInvites: state.pendingInvites.filter((inv) => inv.id !== inviteId),
          }),
          false,
          'members/cancelInvite/optimistic',
        );

        try {
          await apiClient.delete(`/api/workspaces/${workspaceId}/invitations/${inviteId}`, {
            token,
          });
        } catch (err) {
          // Rollback on failure
          set({ pendingInvites: previousInvites }, false, 'members/cancelInvite/rollback');
          const message = err instanceof Error ? err.message : 'Failed to cancel invite';
          set({ error: message }, false, 'members/cancelInvite/error');
          throw err;
        }
      },

      clearError: () => set({ error: null }, false, 'members/clearError'),
    }),
    { name: 'MembersStore' },
  ),
);

// ─── Selectors ─────────────────────────────────────────────────────────────

/**
 * Return members sorted: OWNER first, then ADMIN, EDITOR, VIEWER.
 */
export function selectSortedMembers(members: WorkspaceMember[]): WorkspaceMember[] {
  const RANK: Record<MemberRole, number> = {
    OWNER: 4,
    ADMIN: 3,
    EDITOR: 2,
    VIEWER: 1,
  };
  return [...members].sort((a, b) => RANK[b.role] - RANK[a.role]);
}

/**
 * Check whether the current user can manage members (OWNER or ADMIN).
 */
export function canManageMembers(currentUserRole: MemberRole | null): boolean {
  return currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
}

/**
 * Check whether the current user can change the target member's role.
 * OWNERs cannot be demoted by non-OWNER admins.
 */
export function canChangeRole(currentUserRole: MemberRole | null, targetRole: MemberRole): boolean {
  if (!currentUserRole) return false;
  if (currentUserRole === 'OWNER') return targetRole !== 'OWNER'; // cannot change owner's own role
  if (currentUserRole === 'ADMIN') return targetRole !== 'OWNER' && targetRole !== 'ADMIN';
  return false;
}

/**
 * Check whether the current user can remove the target member.
 */
export function canRemoveMember(
  currentUserRole: MemberRole | null,
  targetRole: MemberRole,
  currentUserId: string,
  targetUserId: string,
): boolean {
  if (!currentUserRole) return false;
  // Cannot remove yourself
  if (currentUserId === targetUserId) return false;
  // Cannot remove OWNER
  if (targetRole === 'OWNER') return false;
  // ADMIN can remove EDITOR and VIEWER
  if (currentUserRole === 'ADMIN') return targetRole !== 'ADMIN';
  // OWNER can remove anyone except themselves
  return currentUserRole === 'OWNER';
}
