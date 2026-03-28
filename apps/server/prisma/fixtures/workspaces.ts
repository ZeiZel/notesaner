import { Prisma, WorkspaceRole } from '@prisma/client';
import { USER_IDS } from './users';

// ─── Deterministic IDs ───────────────────────────────────────────────────────

export const WORKSPACE_IDS = {
  personal: '00000000-0000-4000-b000-000000000001',
  team: '00000000-0000-4000-b000-000000000002',
  publicVault: '00000000-0000-4000-b000-000000000003',
} as const;

export type SeedWorkspaceId = (typeof WORKSPACE_IDS)[keyof typeof WORKSPACE_IDS];

// ─── Workspace Fixtures ──────────────────────────────────────────────────────

export interface SeedWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  storagePath: string;
  isPublic: boolean;
  publicSlug: string | null;
  settings: Prisma.InputJsonValue;
}

export function buildWorkspaces(): SeedWorkspace[] {
  return [
    {
      id: WORKSPACE_IDS.personal,
      name: "Alice's Personal Vault",
      slug: 'alice-personal',
      description: 'Personal knowledge base with daily notes and research',
      storagePath: '/var/lib/notesaner/workspaces/alice-personal',
      isPublic: false,
      publicSlug: null,
      settings: {
        defaultEditor: 'markdown',
        dailyNotesFolder: 'daily',
        attachmentsFolder: 'assets',
      },
    },
    {
      id: WORKSPACE_IDS.team,
      name: 'Engineering Team Wiki',
      slug: 'engineering-wiki',
      description: 'Shared engineering documentation and ADRs',
      storagePath: '/var/lib/notesaner/workspaces/engineering-wiki',
      isPublic: false,
      publicSlug: null,
      settings: {
        defaultEditor: 'markdown',
        requireApproval: true,
        templateFolder: 'templates',
      },
    },
    {
      id: WORKSPACE_IDS.publicVault,
      name: 'Open Knowledge Garden',
      slug: 'open-garden',
      description: 'A publicly accessible digital garden',
      storagePath: '/var/lib/notesaner/workspaces/open-garden',
      isPublic: true,
      publicSlug: 'open-garden',
      settings: {
        defaultEditor: 'markdown',
        showGraphView: true,
      },
    },
  ];
}

// ─── Workspace Member Fixtures ───────────────────────────────────────────────

export const MEMBER_IDS = {
  alicePersonalOwner: '00000000-0000-4000-c000-000000000001',
  teamAdminAdmin: '00000000-0000-4000-c000-000000000002',
  teamAliceEditor: '00000000-0000-4000-c000-000000000003',
  teamBobEditor: '00000000-0000-4000-c000-000000000004',
  teamGuestViewer: '00000000-0000-4000-c000-000000000005',
  gardenAdminOwner: '00000000-0000-4000-c000-000000000006',
  gardenAliceEditor: '00000000-0000-4000-c000-000000000007',
} as const;

export interface SeedWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export function buildWorkspaceMembers(): SeedWorkspaceMember[] {
  return [
    // Alice's personal vault — she is the sole owner
    {
      id: MEMBER_IDS.alicePersonalOwner,
      workspaceId: WORKSPACE_IDS.personal,
      userId: USER_IDS.alice,
      role: WorkspaceRole.OWNER,
    },

    // Engineering team wiki
    {
      id: MEMBER_IDS.teamAdminAdmin,
      workspaceId: WORKSPACE_IDS.team,
      userId: USER_IDS.admin,
      role: WorkspaceRole.OWNER,
    },
    {
      id: MEMBER_IDS.teamAliceEditor,
      workspaceId: WORKSPACE_IDS.team,
      userId: USER_IDS.alice,
      role: WorkspaceRole.EDITOR,
    },
    {
      id: MEMBER_IDS.teamBobEditor,
      workspaceId: WORKSPACE_IDS.team,
      userId: USER_IDS.bob,
      role: WorkspaceRole.EDITOR,
    },
    {
      id: MEMBER_IDS.teamGuestViewer,
      workspaceId: WORKSPACE_IDS.team,
      userId: USER_IDS.guest,
      role: WorkspaceRole.VIEWER,
    },

    // Open knowledge garden
    {
      id: MEMBER_IDS.gardenAdminOwner,
      workspaceId: WORKSPACE_IDS.publicVault,
      userId: USER_IDS.admin,
      role: WorkspaceRole.OWNER,
    },
    {
      id: MEMBER_IDS.gardenAliceEditor,
      workspaceId: WORKSPACE_IDS.publicVault,
      userId: USER_IDS.alice,
      role: WorkspaceRole.EDITOR,
    },
  ];
}

// ─── Prisma Upsert Helpers ───────────────────────────────────────────────────

export function getWorkspaceUpserts(): Prisma.WorkspaceUpsertArgs[] {
  return buildWorkspaces().map((ws) => ({
    where: { id: ws.id },
    update: {
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      storagePath: ws.storagePath,
      isPublic: ws.isPublic,
      publicSlug: ws.publicSlug,
      settings: ws.settings,
    },
    create: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      storagePath: ws.storagePath,
      isPublic: ws.isPublic,
      publicSlug: ws.publicSlug,
      settings: ws.settings,
    },
  }));
}

export function getWorkspaceMemberUpserts(): Prisma.WorkspaceMemberUpsertArgs[] {
  return buildWorkspaceMembers().map((m) => ({
    where: {
      workspaceId_userId: {
        workspaceId: m.workspaceId,
        userId: m.userId,
      },
    },
    update: {
      role: m.role,
    },
    create: {
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
    },
  }));
}
