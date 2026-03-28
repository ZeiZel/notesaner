import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
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

/**
 * All comments for a note (sorted set, score = unix ms timestamp).
 * Used by the moderation queue.
 */
function allCommentsKey(noteId: string): string {
  return `rc:${noteId}:all`;
}

/**
 * Approved comment IDs for a note (sorted set, score = unix ms timestamp).
 * Used for public listing.
 */
function approvedCommentsKey(noteId: string): string {
  return `rc:${noteId}:approved`;
}

/** Individual comment hash. */
function commentKey(commentId: string): string {
  return `rc:comment:${commentId}`;
}

/** Rate-limit counter: IP × note. */
function rateLimitKey(ip: string, noteId: string): string {
  return `rc:rl:${ip}:${noteId}`;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface ReaderCommentDto {
  id: string;
  noteId: string;
  content: string;
  authorName: string | null;
  /** Deliberately omitted from public listing — only exposed in moderation queue. */
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
  /** Inline replies (only populated at the root level when parentId=null). */
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

// ─── Stored shape (Redis hash fields) ─────────────────────────────────────────

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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReaderCommentsService {
  private readonly logger = new Logger(ReaderCommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkeyService: ValkeyService,
    private readonly jobsService: JobsService,
  ) {}

  // ─── Public: create comment ───────────────────────────────────────────────

  /**
   * Submit a reader comment on a published note.
   *
   * Guards:
   *   1. Honeypot check — immediate 400 if filled
   *   2. Note existence + published + comments enabled check
   *   3. Per-IP rate limit (5 comments / hour per note)
   *   4. Parent depth check — only 1 level of replies allowed
   *
   * Comments are stored with `status=pending` and require owner approval
   * before becoming visible. An email notification is enqueued to alert
   * the note owner.
   */
  async createComment(
    publicSlug: string,
    notePath: string,
    dto: CreateReaderCommentDto,
    clientIp: string,
  ): Promise<ReaderCommentDto> {
    // 1. Honeypot spam check
    if (dto.honeypot !== undefined && dto.honeypot !== '') {
      this.logger.warn(`Honeypot triggered for ${publicSlug}/${notePath} from ${clientIp}`);
      // Return success to confuse bots, but do not store anything
      throw new ForbiddenException('Comment submission rejected');
    }

    // 2. Resolve note
    const { note, workspace } = await this.resolvePublicNote(publicSlug, notePath);

    // 3. Comments enabled check (workspace setting)
    const settings = (workspace.settings ?? {}) as Record<string, unknown>;
    if (settings['commentsEnabled'] === false) {
      throw new ForbiddenException('Comments are disabled for this vault');
    }

    // 4. Rate limit
    await this.enforceRateLimit(clientIp, note.id);

    // 5. Parent depth check — only 1 level of threading
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

    // 6. Persist
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

    // 7. Email notification to note owner (fire-and-forget)
    void this.notifyNoteOwner(note, workspace, comment).catch((err) => {
      this.logger.error(`Failed to enqueue comment notification: ${err}`);
    });

    return this.toReaderCommentDto(comment);
  }

  // ─── Public: list approved comments ──────────────────────────────────────

  /**
   * Returns approved comments for a published note, threaded 1 level deep.
   * Root comments (parentId=null) appear first, replies nested under parents.
   */
  async listApprovedComments(
    publicSlug: string,
    notePath: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<CommentListResponse> {
    const { note } = await this.resolvePublicNote(publicSlug, notePath);

    const client = this.valkeyService.getClient();
    const key = approvedCommentsKey(note.id);

    // Get total count
    const total = await client.zcard(key);

    // Pagination via ZRANGE (descending by score = most recent first)
    const offset = (page - 1) * pageSize;
    const ids = await client.zrange(key, offset, offset + pageSize - 1, 'REV');

    if (ids.length === 0) {
      return { comments: [], total };
    }

    // Batch-fetch comment hashes
    const rawComments = await this.batchGetComments(ids);

    // Build threaded structure — separate roots from replies
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

    // Attach replies to their parent roots
    for (const root of roots) {
      root.replies = replyMap.get(root.id) ?? [];
    }

    return { comments: roots, total };
  }

  // ─── Moderation: list pending comments ───────────────────────────────────

  /**
   * Returns the full moderation queue (pending comments) for a workspace note.
   * Only accessible to the workspace owner/admin.
   */
  async getModerationQueue(workspaceId: string, noteId: string): Promise<ModerationQueueResponse> {
    // Verify note belongs to workspace
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const client = this.valkeyService.getClient();
    const allKey = allCommentsKey(note.id);

    // Fetch all comment IDs (newest first)
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

  // ─── Moderation: moderate a comment ──────────────────────────────────────

  /**
   * Approve or reject a pending comment.
   * Called by the note owner after verifying workspace membership.
   *
   * Approval: moves comment ID from pending → approved sorted set.
   * Rejection: updates status only, removes from public listing.
   */
  async moderateComment(
    commentId: string,
    workspaceId: string,
    action: CommentModerationAction,
  ): Promise<ReaderCommentDto> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Verify the comment's note belongs to the caller's workspace
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
      // Remove from public approved set if it was previously approved
      await client.zrem(approvedCommentsKey(comment.noteId), commentId);
      this.logger.log(`Comment ${commentId} rejected`);
    }

    const updated = await this.getCommentById(commentId);
    if (!updated) {
      throw new NotFoundException(`Comment ${commentId} not found after moderation`);
    }
    return this.toReaderCommentDto(updated, true);
  }

  // ─── GDPR: delete a comment ───────────────────────────────────────────────

  /**
   * Permanently deletes a comment and all its replies.
   * Called by the note owner for GDPR compliance.
   * Also handles cascading deletion of replies when deleting a root comment.
   */
  async deleteComment(commentId: string, workspaceId: string): Promise<void> {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Verify workspace ownership
    const note = await this.prisma.note.findFirst({
      where: { id: comment.noteId, workspaceId },
    });
    if (!note) {
      throw new ForbiddenException('Comment does not belong to your workspace');
    }

    const client = this.valkeyService.getClient();

    // If this is a root comment, also delete all replies
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

  // ─── Comment count ────────────────────────────────────────────────────────

  /**
   * Returns the number of approved comments for a published note.
   * Lightweight — uses ZCARD on the approved set.
   */
  async getCommentCount(publicSlug: string, notePath: string): Promise<ReaderCommentCountDto> {
    const { note } = await this.resolvePublicNote(publicSlug, notePath);
    const client = this.valkeyService.getClient();
    const count = await client.zcard(approvedCommentsKey(note.id));
    return { count };
  }

  // ─── User-scoped moderation (resolves workspace from userId) ─────────────

  /**
   * Moderate a comment on behalf of an authenticated user.
   * Resolves the user's workspace membership to find which workspace owns
   * the comment's note, then delegates to moderateComment.
   */
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

  /**
   * Delete a comment on behalf of an authenticated user.
   * Resolves the user's workspace membership to find which workspace owns
   * the comment's note, then delegates to deleteComment.
   */
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

    // Verify the user is an ADMIN or OWNER of the workspace
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

    // Set TTL on first increment
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

    // Store all fields in a single HSET call
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

    // Add to the all-comments sorted set (for moderation queue)
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
    // Find the workspace owner to notify
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
