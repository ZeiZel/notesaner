import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import { JobsService } from '../jobs/jobs.service';
import type { CreateReaderCommentDto } from './dto/create-reader-comment.dto';
import type { CommentModerationAction } from './dto/moderate-comment.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max comments allowed per IP per note per hour. */
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_COMMENTS = 5;

/** Max comment content length (double-checked server-side). */
const MAX_CONTENT_LENGTH = 2_000;

/** Default number of approved comments returned per page. */
const DEFAULT_PAGE_SIZE = 20;

// ─── Key helpers ──────────────────────────────────────────────────────────────

function allCommentsKey(noteId: string): string {
  return `rc:${noteId}:all`;
}

function approvedCommentsKey(noteId: string): string {
  return `rc:${noteId}:approved`;
}

function commentKey(commentId: string): string {
  return `rc:comment:${commentId}`;
}

function rateLimitKey(ip: string, noteId: string): string {
  return `rc:rl:${ip}:${noteId}`;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface ReaderCommentDto {
  id: string;
  noteId: string;
  content: string;
  authorName: string | null;
  authorEmail?: string | null;
  parentId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PublicReaderCommentDto {
  id: string;
  content: string;
  authorName: string | null;
  parentId: string | null;
  createdAt: string;
  replies: PublicReaderCommentDto[];
}

export interface ReaderCommentCountDto {
  count: number;
}

export interface CommentListResponse {
  comments: PublicReaderCommentDto[];
  total: number;
}

export interface ModerationQueueResponse {
  pending: ReaderCommentDto[];
  total: number;
}

interface StoredComment {
  id: string;
  noteId: string;
  content: string;
  authorName: string;
  authorEmail: string;
  parentId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

@Injectable()
export class ReaderCommentsService {
  private readonly logger = new Logger(ReaderCommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
    private readonly jobsService: JobsService,
  ) {}

  async createComment(
    publicSlug: string,
    notePath: string,
    dto: CreateReaderCommentDto,
    clientIp: string,
  ): Promise<ReaderCommentDto> {
    if (dto.honeypot !== undefined && dto.honeypot !== '') {
      this.logger.warn(`Honeypot triggered for ${publicSlug}/${notePath} from ${clientIp}`);
      throw new ForbiddenException('Comment submission rejected');
    }

    const { note, workspace } = await this.resolvePublicNote(publicSlug, notePath);

    const settings = (workspace.settings ?? {}) as Record<string, unknown>;
    if (settings['commentsEnabled'] === false) {
      throw new ForbiddenException('Comments are disabled for this vault');
    }

    await this.enforceRateLimit(clientIp, note.id);

    if (dto.parentId) {
      const parent = await this.getCommentById(dto.parentId);
      if (!parent) {
        throw new BadRequestException('Parent comment not found');
      }
      if (parent.parentId) {
        throw new BadRequestException(
          'Replies to replies are not supported — only 1 level of threading is allowed',
        );
      }
      if (parent.noteId !== note.id) {
        throw new BadRequestException('Parent comment does not belong to this note');
      }
    }

    const commentId = randomUUID();
    const now = new Date();
    const comment: StoredComment = {
      id: commentId,
      noteId: note.id,
      content: dto.content.slice(0, MAX_CONTENT_LENGTH),
      authorName: dto.authorName ?? '',
      authorEmail: dto.authorEmail ?? '',
      parentId: dto.parentId ?? '',
      status: 'pending',
      createdAt: now.toISOString(),
    };

    await this.storeComment(comment);

    this.logger.log(
      `New reader comment ${commentId} on note ${note.id} (${publicSlug}/${notePath}) — status=pending`,
    );

    void this.notifyNoteOwner(note, workspace, comment).catch((err) => {
      this.logger.error(`Failed to enqueue comment notification: ${err}`);
    });

    return this.toReaderCommentDto(comment);
  }

  async listApprovedComments(
    publicSlug: string,
    notePath: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<CommentListResponse> {
    const { note } = await this.resolvePublicNote(publicSlug, notePath);

    const client = this.valkeyService.getClient();
    const key = approvedCommentsKey(note.id);

    const total = await client.zcard(key);

    const offset = (page - 1) * pageSize;
    const ids = await client.zrange(key, offset, offset + pageSize - 1, 'REV');

    if (ids.length === 0) {
      return { comments: [], total };
    }

    const rawComments = await this.batchGetComments(ids);

    const roots: PublicReaderCommentDto[] = [];
    const replyMap = new Map<string, PublicReaderCommentDto[]>();

    for (const c of rawComments) {
      const dto = this.toPublicDto(c);
      if (!c.parentId) {
        roots.push(dto);
      } else {
        const list = replyMap.get(c.parentId) ?? [];
        list.push(dto);
        replyMap.set(c.parentId, list);
      }
    }

    for (const root of roots) {
      root.replies = replyMap.get(root.id) ?? [];
    }

    return { comments: roots, total };
  }

  async getModerationQueue(workspaceId: string, noteId: string): Promise<ModerationQueueResponse> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const client = this.valkeyService.getClient();
    const allKey = allCommentsKey(note.id);

    const allIds = await client.zrange(allKey, 0, -1, 'REV');

    if (allIds.length === 0) {
      return { pending: [], total: 0 };
    }

    const allComments = await this.batchGetComments(allIds);
    const pending = allComments
      .filter((c) => c.status === 'pending')
      .map((c) => this.toReaderCommentDto(c, true));

    return { pending, total: pending.length };
  }

  async moderateComment(
    commentId: string,
    workspaceId: string,
    action: CommentModerationAction,
  ): Promise<ReaderCommentDto> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const note = await this.prisma.note.findFirst({
      where: { id: comment.noteId, workspaceId },
    });
    if (!note) {
      throw new ForbiddenException('Comment does not belong to your workspace');
    }

    const client = this.valkeyService.getClient();
    const commentHashKey = commentKey(commentId);

    if (action === 'approve') {
      await client.hset(commentHashKey, 'status', 'approved');
      const score = new Date(comment.createdAt).getTime();
      await client.zadd(approvedCommentsKey(comment.noteId), score, commentId);
      this.logger.log(`Comment ${commentId} approved`);
    } else {
      await client.hset(commentHashKey, 'status', 'rejected');
      await client.zrem(approvedCommentsKey(comment.noteId), commentId);
      this.logger.log(`Comment ${commentId} rejected`);
    }

    const updated = await this.getCommentById(commentId);
    if (!updated) {
      throw new NotFoundException(`Comment ${commentId} not found after moderation`);
    }
    return this.toReaderCommentDto(updated, true);
  }

  async deleteComment(commentId: string, workspaceId: string): Promise<void> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const note = await this.prisma.note.findFirst({
      where: { id: comment.noteId, workspaceId },
    });
    if (!note) {
      throw new ForbiddenException('Comment does not belong to your workspace');
    }

    const client = this.valkeyService.getClient();

    if (!comment.parentId) {
      const allIds = await client.zrange(allCommentsKey(comment.noteId), 0, -1);
      const replies = await this.batchGetComments(allIds);
      const replyIds = replies.filter((r) => r.parentId === commentId).map((r) => r.id);

      for (const replyId of replyIds) {
        await this.hardDeleteComment(replyId, comment.noteId);
      }
    }

    await this.hardDeleteComment(commentId, comment.noteId);

    this.logger.log(`Comment ${commentId} permanently deleted (GDPR) for workspace ${workspaceId}`);
  }

  async getCommentCount(publicSlug: string, notePath: string): Promise<ReaderCommentCountDto> {
    const { note } = await this.resolvePublicNote(publicSlug, notePath);
    const client = this.valkeyService.getClient();
    const count = await client.zcard(approvedCommentsKey(note.id));
    return { count };
  }

  async moderateCommentByUser(
    commentId: string,
    userId: string,
    action: CommentModerationAction,
  ): Promise<ReaderCommentDto> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const workspaceId = await this.resolveWorkspaceIdForNote(comment.noteId, userId);
    return this.moderateComment(commentId, workspaceId, action);
  }

  async deleteCommentByUser(commentId: string, userId: string): Promise<void> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const workspaceId = await this.resolveWorkspaceIdForNote(comment.noteId, userId);
    return this.deleteComment(commentId, workspaceId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveWorkspaceIdForNote(noteId: string, userId: string): Promise<string> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { workspaceId: true },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: note.workspaceId,
        userId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have permission to moderate comments in this workspace',
      );
    }

    return note.workspaceId;
  }

  private async resolvePublicNote(
    publicSlug: string,
    notePath: string,
  ): Promise<{
    note: { id: string; title: string; workspaceId: string };
    workspace: { id: string; name: string; settings: unknown };
  }> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { publicSlug, isPublic: true },
      select: { id: true, name: true, settings: true },
    });

    if (!workspace) {
      throw new NotFoundException('Public vault not found');
    }

    const lookupPath = notePath.endsWith('.md') ? notePath : `${notePath}.md`;

    const note = await this.prisma.note.findFirst({
      where: {
        workspaceId: workspace.id,
        path: lookupPath,
        isPublished: true,
        isTrashed: false,
      },
      select: { id: true, title: true, workspaceId: true },
    });

    if (!note) {
      throw new NotFoundException('Published note not found');
    }

    return { note, workspace };
  }

  private async enforceRateLimit(clientIp: string, noteId: string): Promise<void> {
    const client = this.valkeyService.getClient();
    const key = rateLimitKey(clientIp, noteId);

    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > RATE_LIMIT_MAX_COMMENTS) {
      throw new TooManyRequestsException(
        'Too many comments submitted. Please wait before commenting again.',
      );
    }
  }

  private async storeComment(comment: StoredComment): Promise<void> {
    const client = this.valkeyService.getClient();
    const hashKey = commentKey(comment.id);
    const score = new Date(comment.createdAt).getTime();

    await client.hset(hashKey, {
      id: comment.id,
      noteId: comment.noteId,
      content: comment.content,
      authorName: comment.authorName,
      authorEmail: comment.authorEmail,
      parentId: comment.parentId,
      status: comment.status,
      createdAt: comment.createdAt,
    });

    await client.zadd(allCommentsKey(comment.noteId), score, comment.id);
  }

  private async getCommentById(commentId: string): Promise<StoredComment | null> {
    const client = this.valkeyService.getClient();
    const data = await client.hgetall(commentKey(commentId));

    if (!data || !data['id']) {
      return null;
    }

    return data as unknown as StoredComment;
  }

  private async batchGetComments(ids: string[]): Promise<StoredComment[]> {
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map((id) => this.getCommentById(id)));
    return results.filter((c): c is StoredComment => c !== null);
  }

  private async hardDeleteComment(commentId: string, noteId: string): Promise<void> {
    const client = this.valkeyService.getClient();
    await client.del(commentKey(commentId));
    await client.zrem(allCommentsKey(noteId), commentId);
    await client.zrem(approvedCommentsKey(noteId), commentId);
  }

  private async notifyNoteOwner(
    note: { id: string; title: string; workspaceId: string },
    workspace: { id: string; name: string },
    comment: StoredComment,
  ): Promise<void> {
    const owner = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, role: 'OWNER' },
      include: { user: { select: { email: true, displayName: true } } },
    });

    if (!owner) return;

    await this.jobsService.enqueueSendEmail(owner.user.email, 'comment-mention', {
      ownerName: owner.user.displayName,
      noteTitle: note.title,
      workspaceName: workspace.name,
      authorName: comment.authorName || 'Anonymous',
      commentContent: comment.content.slice(0, 200),
      commentId: comment.id,
      noteId: note.id,
      workspaceId: note.workspaceId,
    });
  }

  private toReaderCommentDto(comment: StoredComment, includeEmail = false): ReaderCommentDto {
    const dto: ReaderCommentDto = {
      id: comment.id,
      noteId: comment.noteId,
      content: comment.content,
      authorName: comment.authorName || null,
      parentId: comment.parentId || null,
      status: comment.status as ReaderCommentDto['status'],
      createdAt: comment.createdAt,
    };

    if (includeEmail) {
      dto.authorEmail = comment.authorEmail || null;
    }

    return dto;
  }

  private toPublicDto(comment: StoredComment): PublicReaderCommentDto {
    return {
      id: comment.id,
      content: comment.content,
      authorName: comment.authorName || null,
      parentId: comment.parentId || null,
      createdAt: comment.createdAt,
      replies: [],
    };
  }
}
