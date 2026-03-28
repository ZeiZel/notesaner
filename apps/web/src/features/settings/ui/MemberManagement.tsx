'use client';

/**
 * MemberManagement -- admin view for workspace members.
 *
 * Features:
 *   - Paginated member list (placeholder data until API hook is wired)
 *   - Invite member via email (useActionState form)
 *   - Role change and remove member (stub handlers)
 *
 * Admin-only; guard via the parent SettingsDialog tab visibility.
 * Styled with Ant Design Avatar, Tag, Button, Input, Typography, Card.
 */

import { useActionState, useState } from 'react';
import { Avatar, Tag, Button, Input, Typography, Card, Space } from 'antd';
import { Box } from '@/shared/ui';

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
// Stub data
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

const ROLE_TAG_COLORS: Record<WorkspaceMember['role'], string> = {
  owner: 'gold',
  admin: 'blue',
  editor: 'green',
  viewer: 'default',
};

const ROLE_LABELS: Record<WorkspaceMember['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
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

function MemberRow({
  member,
  onRemove,
}: {
  member: WorkspaceMember;
  onRemove: (id: string) => void;
}) {
  return (
    <Box
      className="flex items-center gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      <Avatar style={{ flexShrink: 0 }}>{member.avatarInitials}</Avatar>

      <Box className="flex-1 min-w-0">
        <Typography.Text strong style={{ fontSize: 14 }}>
          {member.displayName}
        </Typography.Text>
        <Typography.Paragraph type="secondary" ellipsis style={{ fontSize: 12, marginBottom: 0 }}>
          {member.email}
        </Typography.Paragraph>
      </Box>

      <Tag color={ROLE_TAG_COLORS[member.role]}>{ROLE_LABELS[member.role]}</Tag>

      {member.role !== 'owner' && (
        <Button
          type="text"
          danger
          size="small"
          onClick={() => onRemove(member.id)}
          aria-label={`Remove ${member.displayName}`}
        >
          Remove
        </Button>
      )}
    </Box>
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
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <Box className="max-w-2xl" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Member list */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          Members
          <Typography.Text
            type="secondary"
            style={{ marginLeft: 8, fontWeight: 'normal', fontSize: 12 }}
          >
            ({members.length})
          </Typography.Text>
        </Typography.Text>

        <Card size="small" styles={{ body: { padding: '0 12px' } }}>
          {members.map((member) => (
            <MemberRow key={member.id} member={member} onRemove={handleRemoveMember} />
          ))}
        </Card>
      </Box>

      {/* Invite */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Invite member
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginBottom: 12, fontSize: 12 }}
        >
          An invitation email will be sent. They will join as Editor by default.
        </Typography.Text>
        <form action={inviteAction}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              name="email"
              type="email"
              placeholder="colleague@example.com"
              disabled={isInviting}
              autoComplete="email"
              status={inviteState.errors.email ? 'error' : undefined}
              style={{ flex: 1 }}
            />
            <Button type="primary" htmlType="submit" loading={isInviting}>
              Invite
            </Button>
          </Space.Compact>
          {inviteState.errors.email && (
            <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {inviteState.errors.email}
            </Typography.Text>
          )}
          {inviteState.message && !inviteState.errors.email && (
            <Typography.Text
              type={inviteState.success ? 'success' : 'danger'}
              style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            >
              {inviteState.message}
            </Typography.Text>
          )}
        </form>
      </Box>
    </Box>
  );
}
