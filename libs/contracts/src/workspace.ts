import type { WorkspaceRole } from './auth';

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface CreateWorkspaceDto {
  name: string;
  slug: string;
  description?: string;
}

export interface LayoutDto {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  config: LayoutConfig;
  isDefault: boolean;
}

export interface LayoutConfig {
  panels: PanelConfig[];
  orientation: 'horizontal' | 'vertical';
}

export interface PanelConfig {
  id: string;
  type: 'editor' | 'graph' | 'kanban' | 'calendar' | 'excalidraw' | 'settings' | 'plugin';
  size: number;
  tabs?: TabConfig[];
  children?: {
    panels: PanelConfig[];
    orientation: 'horizontal' | 'vertical';
  };
}

export interface TabConfig {
  id: string;
  noteId?: string;
  pluginId?: string;
  title: string;
  isActive: boolean;
}

export interface CommentDto {
  id: string;
  noteId: string;
  userId: string;
  content: string;
  position: { from: number; to: number } | null;
  isResolved: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  replies?: CommentDto[];
}
