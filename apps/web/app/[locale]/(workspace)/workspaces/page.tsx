'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Input, Form, message } from 'antd';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { workspacesApi } from '@/shared/api/workspaces';
import { WorkspaceList } from '@/features/workspace/ui/WorkspaceList';

/**
 * Workspace picker page.
 * Shown when no workspace is selected or when navigating to /workspaces.
 * Allows creating a new workspace or selecting an existing one.
 */
export default function WorkspacesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form] = Form.useForm<{ name: string; description: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const router = useRouter();

  const handleCreateWorkspace = useCallback(async () => {
    if (!accessToken) return;

    try {
      const values = await form.validateFields();
      setIsCreating(true);

      // Generate slug from name
      const slug = values.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const created = await workspacesApi.createWorkspace(accessToken, {
        name: values.name,
        slug,
        description: values.description || undefined,
      });

      // Refresh workspace list and navigate to the new workspace
      await fetchWorkspaces(accessToken);
      setActiveWorkspace(created.id);
      setIsCreateOpen(false);
      form.resetFields();
      void message.success('Workspace created successfully');
      router.push(`/workspaces/${created.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workspace';
      void message.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [accessToken, form, fetchWorkspaces, setActiveWorkspace, router]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Your Workspaces</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Select a workspace to continue, or create a new one.
        </p>
      </div>

      {/* Workspace list from API */}
      <div className="w-full max-w-2xl">
        <WorkspaceList />
      </div>

      {/* Create new workspace button */}
      <button
        type="button"
        onClick={() => setIsCreateOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New workspace
      </button>

      {/* Create workspace modal */}
      <Modal
        title="Create new workspace"
        open={isCreateOpen}
        onOk={() => void handleCreateWorkspace()}
        onCancel={() => {
          setIsCreateOpen(false);
          form.resetFields();
        }}
        confirmLoading={isCreating}
        okText="Create"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Workspace name"
            rules={[
              { required: true, message: 'Please enter a workspace name' },
              { min: 2, message: 'Name must be at least 2 characters' },
            ]}
          >
            <Input placeholder="My Knowledge Base" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea placeholder="A brief description of this workspace" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
