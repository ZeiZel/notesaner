'use client';

/**
 * DangerZone -- destructive workspace actions.
 *
 * Features:
 *   - Transfer ownership to another admin member
 *   - Delete workspace with type-to-confirm guard
 *
 * Styled with Ant Design Card, Button, Select, Input, Alert, Typography.
 */

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Select, Input, Alert, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
import { useMembersStore, type WorkspaceMember } from '@/features/workspace';

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
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Page header */}
      <Box>
        <Typography.Title level={4} type="danger" style={{ marginBottom: 4 }}>
          Danger zone
        </Typography.Title>
        <Typography.Text type="secondary">
          Irreversible actions. Proceed with caution.
        </Typography.Text>
      </Box>

      {/* Error banner */}
      {error && <Alert type="error" message={error} closable onClose={clearError} showIcon />}

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
    </Box>
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
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);

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
    <Card size="small" style={{ borderColor: 'var(--ns-color-warning, #d97706)' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
        Transfer ownership
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', marginBottom: 16, fontSize: 12 }}
      >
        Transfer workspace ownership to another admin member. You will be demoted to Admin role
        after the transfer.
      </Typography.Text>

      {eligibleMembers.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          No eligible members to transfer ownership to. Add another admin first.
        </Typography.Text>
      ) : (
        <>
          <Space size="middle" align="end" style={{ maxWidth: 400 }}>
            <Box style={{ flex: 1 }}>
              <Typography.Text
                type="secondary"
                style={{ display: 'block', marginBottom: 4, fontSize: 12 }}
              >
                New owner
              </Typography.Text>
              <Select
                value={selectedMemberId || undefined}
                onChange={setSelectedMemberId}
                placeholder="Select a member..."
                disabled={isSaving || isPending}
                style={{ width: '100%' }}
                options={eligibleMembers.map((m) => ({
                  value: m.userId,
                  label: `${m.user.displayName} (${m.user.email})`,
                }))}
              />
            </Box>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!selectedMemberId || isSaving || isPending}
              style={{
                borderColor: 'var(--ns-color-warning, #d97706)',
                color: 'var(--ns-color-warning, #d97706)',
              }}
            >
              Transfer
            </Button>
          </Space>

          {showConfirm && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginTop: 16 }}
              message="Are you sure you want to transfer ownership?"
              description="This action cannot be undone by you -- only the new owner can transfer it back."
              action={
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    onClick={handleTransfer}
                    loading={isPending}
                    style={{ backgroundColor: 'var(--ns-color-warning, #d97706)' }}
                  >
                    Confirm transfer
                  </Button>
                  <Button size="small" onClick={() => setShowConfirm(false)} disabled={isPending}>
                    Cancel
                  </Button>
                </Space>
              }
            />
          )}
        </>
      )}
    </Card>
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
    <Card size="small" style={{ borderColor: 'var(--ns-color-destructive)' }}>
      <Typography.Text
        type="danger"
        strong
        style={{ display: 'block', marginBottom: 4, fontSize: 14 }}
      >
        Delete workspace
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        Permanently delete this workspace, all its notes, member associations, and published
        content. This action is irreversible.
      </Typography.Text>

      {!showConfirm ? (
        <Button danger type="primary" onClick={() => setShowConfirm(true)} disabled={isSaving}>
          Delete this workspace
        </Button>
      ) : (
        <Box style={{ marginTop: 16 }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message="This will permanently delete the workspace"
            description="All notes, files, and member data will be lost forever. Published content will become inaccessible immediately."
            style={{ marginBottom: 16 }}
          />

          <Box style={{ marginBottom: 16 }}>
            <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
              Type{' '}
              <Typography.Text code strong type="danger">
                {workspaceName}
              </Typography.Text>{' '}
              to confirm:
            </Typography.Text>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspaceName}
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
              status={confirmText && !isConfirmed ? 'error' : undefined}
            />
          </Box>

          <Space>
            <Button
              danger
              type="primary"
              onClick={handleDelete}
              disabled={!isConfirmed || isPending || isSaving}
              loading={isPending}
            >
              I understand, delete this workspace
            </Button>
            <Button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </Space>
        </Box>
      )}
    </Card>
  );
}
