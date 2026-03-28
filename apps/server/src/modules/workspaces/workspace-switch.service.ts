import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Result of switching to a workspace. Contains workspace details and the
 * user's role within that workspace for immediate client-side usage.
 */
export interface WorkspaceSwitchResult {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
  };
  membership: {
    role: string;
    joinedAt: string;
  };
}

/**
 * Summary of a workspace for listing purposes (includes the user's role
 * and basic stats).
 */
export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  role: string;
  memberCount: number;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * WorkspaceSwitchService — handles multi-workspace listing and switching.
 *
 * Responsibilities:
 *   - List all workspaces a user belongs to with summary stats
 *   - Validate and execute workspace switching (verify membership)
 *   - Return enriched workspace details on switch for client-side hydration
 */
@Injectable()
export class WorkspaceSwitchService {
  private readonly logger = new Logger(WorkspaceSwitchService.name);

  /**
   * Direct PrismaClient instantiation — to be replaced with injected
   * PrismaService once the shared module is available.
   */
  private readonly prisma = new PrismaClient();

  // ---------------------------------------------------------------------------
  // LIST USER WORKSPACES
  // ---------------------------------------------------------------------------

  /**
   * Returns all workspaces the user is a member of, enriched with
   * member count, note count, and the user's role.
   */
  async listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                notes: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      description: m.workspace.description,
      isPublic: m.workspace.isPublic,
      role: m.role,
      memberCount: m.workspace._count.members,
      noteCount: m.workspace._count.notes,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // SWITCH WORKSPACE
  // ---------------------------------------------------------------------------

  /**
   * "Switch" to a workspace — validates the user has membership and returns
   * the full workspace details needed for the client to hydrate state.
   *
   * This is not a stateful server-side operation; the "active workspace" is
   * tracked client-side. This endpoint serves as a validated fetch that
   * guarantees the user has access.
   */
  async switchWorkspace(userId: string, workspaceId: string): Promise<WorkspaceSwitchResult> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      // Check if workspace exists at all (for a better error message)
      const exists = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException(`Workspace ${workspaceId} not found`);
      }

      throw new ForbiddenException('You are not a member of this workspace');
    }

    this.logger.log(
      `User ${userId} switched to workspace ${workspaceId} (${membership.workspace.name})`,
    );

    return {
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        description: membership.workspace.description,
        isPublic: membership.workspace.isPublic,
        createdAt: membership.workspace.createdAt.toISOString(),
        updatedAt: membership.workspace.updatedAt.toISOString(),
      },
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
      },
    };
  }
}
