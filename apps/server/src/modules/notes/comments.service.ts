import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Comment } from '@prisma/client';
import {
  CreateCommentDto,
  CreateCommentSchema,
  CreateReplyDto,
  CreateReplySchema,
  UpdateCommentDto,
  UpdateCommentSchema,
} from './dto/comment.dto';

/** Regex that matches @username tokens in comment text. */
const MENTION_REGEX = /@([\w.-]+)/g;

export interface CommentWithReplies extends Comment {
  user: { id: string; displayName: string; avatarUrl: string | null };
  replies: CommentWithReplies[];
  mentionedUsers: string[];
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  /**
   * We instantiate PrismaClient directly here because the project does not yet
   * have a shared PrismaService / PrismaModule.  When that is introduced this
   * can be replaced with constructor injection.
   */
  private readonly prisma = new PrismaClient();

  // ---------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------

  /**
   * Creates a new root comment on a note.
   * Parses @mentions from content and records them for downstream
   * notifications (emitted as a log here — actual email/push delivery
   * belongs in a jobs processor once the notifications system exists).
   */
  async createComment(
    noteId: string,
    userId: string,
    rawDto: unknown,
  ): Promise<CommentWithReplies> {
    const dto = CreateCommentSchema.parse(rawDto) as CreateCommentDto;

    await this.assertNoteExists(noteId);

    const mentionedUsernames = this.parseMentions(dto.content);

    const comment = await this.prisma.comment.create({
      data: {
        noteId,
        userId,
        content: dto.content,
        position: dto.position ?? undefined,
        parentId: null,
        isResolved: false,
      },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    if (mentionedUsernames.length > 0) {
      this.logger.log(
        `Mentions detected in comment ${comment.id}: ${mentionedUsernames.join(', ')}`,
      );
      // TODO(notifications): dispatch email-notification job per mentioned user
    }

    return { ...comment, replies: [], mentionedUsers: mentionedUsernames };
  }

  // ---------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------

  /**
   * Returns all root-level comments for a note sorted by position (top → bottom).
   * Replies are nested inside each root comment's `replies` array.
   * Sorting by position: comments without a position appear last.
   */
  async listComments(noteId: string): Promise<CommentWithReplies[]> {
    await this.assertNoteExists(noteId);

    // Fetch root comments with their direct replies in a single query.
    const rootComments = await this.prisma.comment.findMany({
      where: { noteId, parentId: null },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
            replies: {
              include: {
                user: { select: { id: true, displayName: true, avatarUrl: true } },
                replies: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Sort root comments by position.from ascending; null positions go last.
    rootComments.sort((a, b) => {
      const posA = this.extractFrom(a.position);
      const posB = this.extractFrom(b.position);

      if (posA === null && posB === null) return 0;
      if (posA === null) return 1;
      if (posB === null) return -1;
      return posA - posB;
    });

    return rootComments.map((c) => this.attachMentions(c));
  }

  // ---------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------

  /**
   * Edits the content of a comment. Only the original author may edit.
   */
  async updateComment(
    commentId: string,
    userId: string,
    rawDto: unknown,
  ): Promise<CommentWithReplies> {
    const dto = UpdateCommentSchema.parse(rawDto) as UpdateCommentDto;

    const existing = await this.findCommentOrThrow(commentId);
    this.assertAuthor(existing, userId, 'edit');

    const mentionedUsernames = this.parseMentions(dto.content);

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (mentionedUsernames.length > 0) {
      this.logger.log(
        `Mentions detected in updated comment ${updated.id}: ${mentionedUsernames.join(', ')}`,
      );
    }

    return this.attachMentions(updated);
  }

  // ---------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------

  /**
   * Deletes a comment. Only the author or an admin may delete.
   * Deleting a root comment cascades to its replies (via DB constraint).
   */
  async deleteComment(
    commentId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const existing = await this.findCommentOrThrow(commentId);

    if (!isAdmin && existing.userId !== userId) {
      throw new ForbiddenException('Only the author or an admin may delete this comment');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    this.logger.log(`Comment ${commentId} deleted by user ${userId}`);
  }

  // ---------------------------------------------------------------
  // REPLY
  // ---------------------------------------------------------------

  /**
   * Adds a reply to a root-level comment.
   * Replying to a reply (nested beyond depth 1) is rejected to keep
   * the threading model simple.
   */
  async createReply(
    parentCommentId: string,
    userId: string,
    rawDto: unknown,
  ): Promise<CommentWithReplies> {
    const dto = CreateReplySchema.parse(rawDto) as CreateReplyDto;

    const parent = await this.findCommentOrThrow(parentCommentId);

    if (parent.parentId !== null) {
      throw new UnprocessableEntityException(
        'Cannot reply to a reply; only root-level comments may be threaded',
      );
    }

    const mentionedUsernames = this.parseMentions(dto.content);

    const reply = await this.prisma.comment.create({
      data: {
        noteId: parent.noteId,
        userId,
        content: dto.content,
        // Replies have no position anchor; Prisma requires JsonNull for nullable Json columns.
        position: undefined,
        parentId: parentCommentId,
        isResolved: false,
      },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    if (mentionedUsernames.length > 0) {
      this.logger.log(
        `Mentions detected in reply ${reply.id}: ${mentionedUsernames.join(', ')}`,
      );
    }

    const replyWithUser = reply as typeof reply & {
      user: { id: string; displayName: string; avatarUrl: string | null };
    };
    return { ...replyWithUser, replies: [], mentionedUsers: mentionedUsernames };
  }

  // ---------------------------------------------------------------
  // RESOLVE / REOPEN
  // ---------------------------------------------------------------

  /**
   * Marks a root comment thread as resolved or reopens it.
   * Only root comments can be resolved; replies are ignored.
   */
  async resolveComment(commentId: string, userId: string): Promise<CommentWithReplies> {
    const existing = await this.findCommentOrThrow(commentId);

    if (existing.parentId !== null) {
      throw new UnprocessableEntityException('Only root-level comments can be resolved');
    }

    // Toggle: resolve if open, reopen if already resolved.
    const newState = !existing.isResolved;

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { isResolved: newState },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.logger.log(
      `Comment ${commentId} marked as ${newState ? 'resolved' : 'unresolved'} by user ${userId}`,
    );

    return this.attachMentions(updated);
  }

  // ---------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------

  private async assertNoteExists(noteId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId }, select: { id: true } });
    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }
  }

  private async findCommentOrThrow(commentId: string): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }
    return comment;
  }

  private assertAuthor(comment: Comment, userId: string, action: string): void {
    if (comment.userId !== userId) {
      throw new ForbiddenException(`Only the comment author may ${action} this comment`);
    }
  }

  /**
   * Extracts @username tokens from comment text.
   * Returns a deduplicated array of usernames (without the @ prefix).
   */
  parseMentions(content: string): string[] {
    const matches = content.matchAll(MENTION_REGEX);
    const usernames = new Set<string>();
    for (const match of matches) {
      if (match[1]) usernames.add(match[1]);
    }
    return [...usernames];
  }

  /**
   * Recursively attaches computed `mentionedUsers` to a comment and its replies.
   * The Prisma include returns replies as a nested array; we normalise that here.
   */
  private attachMentions(
    comment: Comment & {
      user: { id: string; displayName: string; avatarUrl: string | null };
      replies?: Array<
        Comment & {
          user: { id: string; displayName: string; avatarUrl: string | null };
          replies?: unknown[];
        }
      >;
    },
  ): CommentWithReplies {
    const replies: CommentWithReplies[] = (comment.replies ?? []).map((r) =>
      this.attachMentions(r as Parameters<typeof this.attachMentions>[0]),
    );

    return {
      ...(comment as Comment & { user: { id: string; displayName: string; avatarUrl: string | null } }),
      replies,
      mentionedUsers: this.parseMentions(comment.content),
    };
  }

  /**
   * Safely reads the `from` field from a position JSON blob.
   * Returns null if the blob is missing or malformed.
   */
  private extractFrom(position: unknown): number | null {
    if (
      position !== null &&
      typeof position === 'object' &&
      'from' in (position as object) &&
      typeof (position as { from: unknown }).from === 'number'
    ) {
      return (position as { from: number }).from;
    }
    return null;
  }
}
