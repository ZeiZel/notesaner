'use client';

/**
 * useFolderTree -- TanStack Query hook for fetching the workspace folder tree.
 *
 * Used by the quick capture modal folder picker (TreeSelect).
 * Returns data in a format compatible with Ant Design TreeSelect.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { quickCaptureApi, type FolderTreeNode } from '@/shared/api/quick-capture';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const folderKeys = {
  all: ['folders'] as const,
  tree: (workspaceId: string) => [...folderKeys.all, 'tree', workspaceId] as const,
};

// ---------------------------------------------------------------------------
// Ant Design TreeSelect data format
// ---------------------------------------------------------------------------

export interface TreeSelectNode {
  title: string;
  value: string;
  key: string;
  children?: TreeSelectNode[];
}

function toTreeSelectData(nodes: FolderTreeNode[]): TreeSelectNode[] {
  return nodes.map((node) => ({
    title: node.name,
    value: node.id,
    key: node.id,
    children: node.children.length > 0 ? toTreeSelectData(node.children) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFolderTree() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: folderKeys.tree(workspaceId ?? ''),
    queryFn: () => {
      if (!workspaceId || !accessToken) {
        return [];
      }
      return quickCaptureApi.listFolders(accessToken, workspaceId);
    },
    enabled: Boolean(workspaceId && accessToken),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  const treeData = useMemo((): TreeSelectNode[] => {
    if (!query.data) return [];

    // Always include an "Inbox" option at the top
    const inboxNode: TreeSelectNode = {
      title: 'Inbox',
      value: '',
      key: '__inbox__',
    };

    return [inboxNode, ...toTreeSelectData(query.data)];
  }, [query.data]);

  return {
    treeData,
    isLoading: query.isLoading,
    error: query.error,
  };
}
