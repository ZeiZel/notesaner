import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * GuestNoteGuard — allows access to a note if the requesting user
 * has an active (non-expired) NoteShare granting the required permission.
 *
 * Usage:
 *   @UseGuards(GuestNoteGuard)
 *   on any endpoint that should support guest (shared) access.
 *
 * Expects:
 *   - `req.params.noteId` — the note being accessed
 *   - `req.user?.sub` — the authenticated user (optional for link shares)
 *   - `req.headers['x-share-token']` — share token for link-based access
 *
 * The guard sets `req.sharePermission` on success so downstream handlers
 * can check what level of access the guest has (VIEW / COMMENT / EDIT).
 */
@Injectable()
export class GuestNoteGuard implements CanActivate {
  private readonly prisma = new PrismaClient();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { noteId?: string };
      user?: { sub: string };
      headers: Record<string, string | undefined>;
      sharePermission?: string;
    }>();

    const noteId = request.params.noteId;
    if (!noteId) {
      throw new ForbiddenException('Note ID is required');
    }

    const userId = request.user?.sub;
    const shareToken = request.headers['x-share-token'];

    // Strategy 1: Authenticated user with a direct share
    if (userId) {
      const share = await this.prisma.noteShare.findFirst({
        where: {
          noteId,
          sharedWith: userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (share) {
        request.sharePermission = share.permission;
        return true;
      }
    }

    // Strategy 2: Link-based access via share token header
    if (shareToken) {
      const share = await this.prisma.noteShare.findUnique({
        where: { token: shareToken },
      });

      if (
        share &&
        share.noteId === noteId &&
        (share.expiresAt === null || share.expiresAt > new Date())
      ) {
        request.sharePermission = share.permission;
        return true;
      }
    }

    throw new ForbiddenException('You do not have access to this note. A valid share is required.');
  }
}
