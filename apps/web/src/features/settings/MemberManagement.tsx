'use client';

/**
 * MemberManagement — admin view for workspace members.
 *
 * Features:
 *   - Paginated member list (placeholder data until API hook is wired)
 *   - Invite member via email (useActionState form)
 *   - Role change and remove member (stub handlers)
 *
 * Admin-only; guard via the parent SettingsDialog tab visibility.
 */

import { useActionState, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceMember {
  id: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string;
  avatarInitials: string;
}

interface InviteState {
  success: boolean;
  message: string;
  errors: Partial<Record<'email', string>>;
}

// ---------------------------------------------------------------------------
// Stub data (replace with useQuery when auth context is available)
// ---------------------------------------------------------------------------

const STUB_MEMBERS: WorkspaceMember[] = [
  {
    id: '1',
    displayName: 'Alice Admin',
    email: 'alice@example.com',
    role: 'owner',
    joinedAt: '2024-01-01',
    avatarInitials: 'AA',
  },
  {
    id: '2',
    displayName: 'Bob Editor',
    email: 'bob@example.com',
    role: 'editor',
    joinedAt: '2024-02-15',
    avatarInitials: 'BE',
  },
  {
    id: '3',
    displayName: 'Carol Viewer',
    email: 'carol@example.com',
    role: 'viewer',
    joinedAt: '2024-03-20',
    avatarInitials: 'CV',
  },
];

const ROLE_LABELS: Record<WorkspaceMember['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<WorkspaceMember['role'], string> = {
  owner: 'var(--ns-color-warning)',
  admin: 'var(--ns-color-primary)',
  editor: 'var(--ns-color-success)',
  viewer: 'var(--ns-color-foreground-muted)',
};

// ---------------------------------------------------------------------------
// Invite action
// ---------------------------------------------------------------------------

async function inviteMemberAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';

  if (!email) {
    return { success: false, message: '', errors: { email: 'Email is required.' } };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: '', errors: { email: 'Enter a valid email address.' } };
  }

  // TODO: call apiClient.post('/api/workspaces/:id/invitations', { email }, { token })
  await new Promise((r) => setTimeout(r, 400));
  return {
    success: true,
    message: `Invitation sent to ${email}.`,
    errors: {},
  };
}

// ---------------------------------------------------------------------------
// MemberRow
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: WorkspaceMember;
  onRemove: (id: string) => void;
}

function MemberRow({ member, onRemove }: MemberRowProps) {
  return (
    <div
      className="flex items-center gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      {/* Avatar */}
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
        style={{
          backgroundColor: 'var(--ns-color-primary)',
          color: 'var(--ns-color-primary-foreground)',
        }}
      >
        {member.avatarInitials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
          {member.displayName}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          {member.email}
        </p>
      </div>

      {/* Role */}
      <span
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{
          backgroundColor: 'var(--ns-color-background)',
          border: '1px solid var(--ns-color-border)',
          color: ROLE_COLORS[member.role],
        }}
      >
        {ROLE_LABELS[member.role]}
      </span>

      {/* Actions — hide for owner */}
      {member.role !== 'owner' && (
        <button
          type="button"
          onClick={() => onRemove(member.id)}
          aria-label={`Remove ${member.displayName}`}
          className="text-xs px-2 py-1 rounded transition-colors hover:bg-background-hover"
          style={{ color: 'var(--ns-color-destructive)' }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberManagement
// ---------------------------------------------------------------------------

export function MemberManagement() {
  const [members, setMembers] = useState<WorkspaceMember[]>(STUB_MEMBERS);
  const [inviteState, inviteAction, isInviting] = useActionState<InviteState, FormData>(
    inviteMemberAction,
    { success: false, message: '', errors: {} },
  );

  function handleRemoveMember(id: string) {
    // TODO: call apiClient.delete('/api/workspaces/:wsId/members/:id', { token })
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Member list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
            Members
            <span
              className="ml-2 text-xs font-normal"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              ({members.length})
            </span>
          </h3>
        </div>

        <div
          className="rounded-lg border px-3"
          style={{
            borderColor: 'var(--ns-color-border)',
            backgroundColor: 'var(--ns-color-background-surface)',
          }}
        >
          {members.map((member) => (
            <MemberRow key={member.id} member={member} onRemove={handleRemoveMember} />
          ))}
        </div>
      </section>

      {/* Invite */}
      <section>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ns-color-foreground)' }}>
          Invite member
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          An invitation email will be sent. They will join as Editor by default.
        </p>
        <form action={inviteAction} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="email"
              type="email"
              placeholder="colleague@example.com"
              disabled={isInviting}
              autoComplete="email"
              className="flex-1 rounded-md px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--ns-color-background-input)',
                border: `1px solid ${inviteState.errors.email ? 'var(--ns-color-destructive)' : 'var(--ns-color-input)'}`,
                color: 'var(--ns-color-foreground)',
              }}
            />
            <button
              type="submit"
              disabled={isInviting}
              className="px-4 py-2 text-sm rounded-md font-medium disabled:opacity-50"
              style={{
                backgroundColor: 'var(--ns-color-primary)',
                color: 'var(--ns-color-primary-foreground)',
              }}
            >
              {isInviting ? 'Sending…' : 'Invite'}
            </button>
          </div>
          {inviteState.errors.email && (
            <p className="text-xs" style={{ color: 'var(--ns-color-destructive)' }}>
              {inviteState.errors.email}
            </p>
          )}
          {inviteState.message && !inviteState.errors.email && (
            <p
              className="text-xs"
              style={{
                color: inviteState.success
                  ? 'var(--ns-color-success)'
                  : 'var(--ns-color-destructive)',
              }}
            >
              {inviteState.message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
