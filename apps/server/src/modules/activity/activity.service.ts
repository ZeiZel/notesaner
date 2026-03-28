import { Injectable, Logger, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityGateway } from './activity.gateway';
import type { ActivityType, Prisma } from '@prisma/client';
import { DEFAULT_ACTIVITY_PAGE_LIMIT, MENTION_REGEX } from './activity.constants';
import type {
  CreateActivityInput,
  ActivityLogDto,
  ActivityListResponse,
  NoteFollowDto,
} from './activity.types';
import type { CreateNotificationInput } from '../notifications/notifications.types';

/**
 * ActivityService — core business logic for the workspace activity feed.
 *
 * Responsibilities:
 *   - Record activity log entries (note CRUD, comments, shares)
 *   - Query activity with pagination and filtering (by type, user, date range)
 *   - Query per-note activity history
 *   - Manage note follow/unfollow subscriptions
 *   - Detect @mentions in content and create notifications for followers
 *   - Push real-time activity via WebSocket gateway
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly gateway: ActivityGateway | null,
    @Optional()
    private readonly notificationsService: NotificationsService | null,
  ) {}

  // ---- Create Activity ----

  /**
   * Records an activity log entry and pushes it via WebSocket.
   *
   * Also triggers notifications for note followers when activity is created
   * on a note they follow (excluding the actor).
   */
  async create(input: CreateActivityInput): Promise<ActivityLogDto> {
    const { workspaceId, userId, noteId, type, metadata } = input;

    const created = await this.prisma.activityLog.create({
      data: {
        workspaceId,
        userId,
        noteId: noteId ?? null,
        type,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const dto = this.toDto(created);

    // Push via WebSocket to workspace members
    this.pushToWebSocket(workspaceId, dto);

    // Notify followers of this note (excluding the actor)
    if (noteId) {
      await this.notifyFollowers(noteId, userId, dto);
    }

    return dto;
  }

  // ---- Query Activity ----

  /**
   * Returns a paginated, filtered list of activity for a workspace.
   */
  async findAllForWorkspace(
    workspaceId: string,
    options: {
      page?: number;
      limit?: number;
      type?: ActivityType;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ): Promise<ActivityListResponse> {
    const page = options.page ?? 1;
    const limit = options.limit ?? DEFAULT_ACTIVITY_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {
      workspaceId,
      ...(options.type !== undefined && { type: options.type }),
      ...(options.userId !== undefined && { userId: options.userId }),
      ...(options.dateFrom || options.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom && { gte: new Date(options.dateFrom) }),
              ...(options.dateTo && { lte: new Date(options.dateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: data.map((item) => this.toDto(item)),
      pagination: {
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Returns activity history for a specific note.
   */
  async findAllForNote(
    noteId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<ActivityListResponse> {
    const page = options.page ?? 1;
    const limit = options.limit ?? DEFAULT_ACTIVITY_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = { noteId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: data.map((item) => this.toDto(item)),
      pagination: {
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      },
    };
  }

  // ---- Note Follow ----

  /**
   * Follow a note. The user will receive notifications for activity on this note.
   */
  async followNote(noteId: string, userId: string): Promise<NoteFollowDto> {
    try {
      const follow = await this.prisma.noteFollow.create({
        data: { noteId, userId },
      });

      return {
        noteId: follow.noteId,
        userId: follow.userId,
        createdAt: follow.createdAt.toISOString(),
      };
    } catch (err) {
      // Prisma unique constraint violation
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Already following this note');
      }
      throw err;
    }
  }

  /**
   * Unfollow a note.
   */
  async unfollowNote(noteId: string, userId: string): Promise<void> {
    const existing = await this.prisma.noteFollow.findUnique({
      where: { noteId_userId: { noteId, userId } },
    });

    if (!existing) {
      throw new NotFoundException('Not following this note');
    }

    await this.prisma.noteFollow.delete({
      where: { noteId_userId: { noteId, userId } },
    });
  }

  /**
   * Check if a user follows a note.
   */
  async isFollowing(noteId: string, userId: string): Promise<boolean> {
    const follow = await this.prisma.noteFollow.findUnique({
      where: { noteId_userId: { noteId, userId } },
    });

    return follow !== null;
  }

  /**
   * Get all followers of a note.
   */
  async getNoteFollowers(noteId: string): Promise<string[]> {
    const follows = await this.prisma.noteFollow.findMany({
      where: { noteId },
      select: { userId: true },
    });

    return follows.map((f) => f.userId);
  }

  // ---- @Mention Detection ----

  /**
   * Detects @mentions in content and returns matching user IDs.
   * Matches against displayName (case-insensitive).
   */
  async detectMentions(workspaceId: string, content: string): Promise<string[]> {
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex
    MENTION_REGEX.lastIndex = 0;

    while ((match = MENTION_REGEX.exec(content)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }

    if (matches.length === 0) {
      return [];
    }

    // Look up workspace members whose displayName matches any of the mentions
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: {
          displayName: {
            in: matches,
            mode: 'insensitive',
          },
        },
      },
      select: { userId: true },
    });

    return [...new Set(members.map((m) => m.userId))];
  }

  // ---- Private helpers ----

  /**
   * Push activity to WebSocket gateway for real-time delivery to workspace members.
   */
  private pushToWebSocket(workspaceId: string, activity: ActivityLogDto): void {
    if (!this.gateway) {
      return;
    }

    try {
      this.gateway.sendToWorkspace(workspaceId, activity);
    } catch (err) {
      this.logger.warn(
        `WebSocket push failed for workspace ${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Notify all followers of a note about new activity.
   * Excludes the actor (the user who created the activity).
   */
  private async notifyFollowers(
    noteId: string,
    actorUserId: string,
    activity: ActivityLogDto,
  ): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    try {
      const followers = await this.getNoteFollowers(noteId);
      const targetFollowers = followers.filter((id) => id !== actorUserId);

      if (targetFollowers.length === 0) {
        return;
      }

      // Create notifications for each follower.
      // We construct CommentMentionMetadata-compatible objects so the
      // discriminated union in CreateNotificationInput is satisfied.
      const noteTitle = (activity.metadata?.noteTitle as string) ?? '';
      const inputs: CreateNotificationInput[] = targetFollowers.map((followerId) => ({
        userId: followerId,
        type: 'COMMENT_MENTION' as const,
        title: 'Activity on followed note',
        body: `${activity.user.displayName} performed ${activity.type.toLowerCase().replace('note_', '')} on a note you follow`,
        noteId,
        metadata: {
          noteId,
          noteTitle,
          commentId: activity.id, // activity ID as reference
          commentPreview: `${activity.type}: ${noteTitle}`,
          mentionedByUserId: activity.userId,
          mentionedByName: activity.user.displayName,
          workspaceId: activity.workspaceId,
          workspaceName: '',
        },
      }));

      await this.notificationsService.createBulk(inputs);
    } catch (err) {
      this.logger.warn(
        `Failed to notify followers for note ${noteId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Maps a Prisma ActivityLog record (with included user) to the API DTO shape.
   */
  private toDto(record: {
    id: string;
    workspaceId: string;
    userId: string;
    user: { id: string; displayName: string; avatarUrl: string | null };
    noteId: string | null;
    type: ActivityType;
    metadata: unknown;
    createdAt: Date;
  }): ActivityLogDto {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      user: {
        id: record.user.id,
        displayName: record.user.displayName,
        avatarUrl: record.user.avatarUrl,
      },
      noteId: record.noteId,
      type: record.type,
      metadata: (record.metadata ?? {}) as Record<string, unknown>,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
