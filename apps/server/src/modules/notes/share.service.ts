import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import {
  CreateShareSchema,
  type CreateShareDto,
  type NoteShareResponse,
  type PublicShareAccessResponse,
} from './dto/share.dto';

/**
 * ShareService — manages note sharing via user email and public links.
 *
 * Supports:
 *   - Share with a specific user by email (VIEW/COMMENT/EDIT)
 *   - Generate a public share link with optional password protection
 *   - Expiration dates on shares
 *   - Access tracking (count + last accessed timestamp)
 *
 * Security:
 *   - Share link passwords are stored as SHA-256 hashes
 *   - Share tokens are cryptographically random (32 bytes, hex-encoded)
 *   - Expired shares are rejected at access time
 */
@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  /**
   * Direct PrismaClient instantiation — to be replaced with injected
   * PrismaService once the shared module is available.
   */
  private readonly prisma = new PrismaClient();

  // ---------------------------------------------------------------------------
  // CREATE SHARE
  // ---------------------------------------------------------------------------

  /**
   * Create a new share for a note. Supports both email-based and link-based
   * sharing via a discriminated union DTO.
   */
  async createShare(noteId: string, userId: string, rawDto: unknown): Promise<NoteShareResponse> {
    const dto = CreateShareSchema.parse(rawDto) as CreateShareDto;

    await this.assertNoteExists(noteId);
    await this.assertUserCanShare(noteId, userId);

    const token = this.generateToken();

    if (dto.type === 'email') {
      return this.createEmailShare(
        noteId,
        userId,
        dto.email,
        dto.permission,
        dto.expiresAt ?? null,
        token,
      );
    }

    return this.createLinkShare(
      noteId,
      userId,
      dto.permission,
      dto.password ?? null,
      dto.expiresAt ?? null,
      token,
    );
  }

  // ---------------------------------------------------------------------------
  // LIST SHARES
  // ---------------------------------------------------------------------------

  /**
   * List all active shares for a note. Only the note creator or workspace
   * admin should call this (authorization is handled at the controller level).
   */
  async listShares(noteId: string): Promise<NoteShareResponse[]> {
    await this.assertNoteExists(noteId);

    const shares = await this.prisma.noteShare.findMany({
      where: { noteId },
      include: {
        sharedWithUser: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => this.toResponse(share));
  }

  // ---------------------------------------------------------------------------
  // DELETE SHARE
  // ---------------------------------------------------------------------------

  /**
   * Revoke a specific share. Only the user who created the share (or a
   * workspace admin) may revoke it.
   */
  async deleteShare(noteId: string, shareId: string, userId: string): Promise<void> {
    const share = await this.prisma.noteShare.findUnique({
      where: { id: shareId },
    });

    if (!share || share.noteId !== noteId) {
      throw new NotFoundException(`Share ${shareId} not found for note ${noteId}`);
    }

    if (share.sharedBy !== userId) {
      // Check if user is workspace admin/owner
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
        select: { workspaceId: true },
      });

      if (note) {
        const membership = await this.prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId: note.workspaceId, userId },
          },
        });

        if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
          throw new ForbiddenException(
            'Only the share creator or a workspace admin may revoke this share',
          );
        }
      }
    }

    await this.prisma.noteShare.delete({ where: { id: shareId } });
    this.logger.log(`Share ${shareId} for note ${noteId} revoked by user ${userId}`);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC SHARE ACCESS (for guests / link-based access)
  // ---------------------------------------------------------------------------

  /**
   * Retrieve share metadata by token. Used by the public share access flow
   * to determine if the share is valid and whether a password is required.
   */
  async getShareByToken(token: string): Promise<PublicShareAccessResponse> {
    const share = await this.prisma.noteShare.findUnique({
      where: { token },
      include: {
        note: { select: { id: true, title: true } },
        sharedByUser: { select: { displayName: true } },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found or has been revoked');
    }

    const isExpired = share.expiresAt !== null && share.expiresAt < new Date();

    return {
      noteId: share.note.id,
      noteTitle: share.note.title,
      permission: share.permission,
      requiresPassword: share.passwordHash !== null,
      isExpired,
      sharedByName: share.sharedByUser.displayName,
    };
  }

  /**
   * Verify the password for a password-protected share link and record
   * access. Returns the note ID if the password is correct.
   */
  async verifySharePassword(
    token: string,
    password: string,
  ): Promise<{ noteId: string; permission: string }> {
    const share = await this.prisma.noteShare.findUnique({
      where: { token },
    });

    if (!share) {
      throw new NotFoundException('Share link not found or has been revoked');
    }

    if (share.expiresAt !== null && share.expiresAt < new Date()) {
      throw new BadRequestException('This share link has expired');
    }

    if (!share.passwordHash) {
      // No password required — just record access
      await this.recordAccess(share.id);
      return { noteId: share.noteId, permission: share.permission };
    }

    const hash = this.hashPassword(password);
    if (hash !== share.passwordHash) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.recordAccess(share.id);
    return { noteId: share.noteId, permission: share.permission };
  }

  /**
   * Access a share link that does not require a password. Records the access.
   */
  async accessShareLink(token: string): Promise<{ noteId: string; permission: string }> {
    const share = await this.prisma.noteShare.findUnique({
      where: { token },
    });

    if (!share) {
      throw new NotFoundException('Share link not found or has been revoked');
    }

    if (share.expiresAt !== null && share.expiresAt < new Date()) {
      throw new BadRequestException('This share link has expired');
    }

    if (share.passwordHash) {
      throw new BadRequestException('This share link requires a password');
    }

    await this.recordAccess(share.id);
    return { noteId: share.noteId, permission: share.permission };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private async createEmailShare(
    noteId: string,
    userId: string,
    email: string,
    permission: string,
    expiresAt: string | null,
    token: string,
  ): Promise<NoteShareResponse> {
    // Look up the target user by email
    const targetUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true },
    });

    if (!targetUser) {
      throw new NotFoundException(`No user found with email ${email}`);
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot share a note with yourself');
    }

    // Check for existing share with same user
    const existingShare = await this.prisma.noteShare.findFirst({
      where: { noteId, sharedWith: targetUser.id },
    });

    if (existingShare) {
      throw new BadRequestException('Note is already shared with this user');
    }

    const share = await this.prisma.noteShare.create({
      data: {
        noteId,
        sharedBy: userId,
        sharedWith: targetUser.id,
        permission: permission as 'VIEW' | 'COMMENT' | 'EDIT',
        token,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        sharedWithUser: { select: { email: true, displayName: true } },
      },
    });

    this.logger.log(`Note ${noteId} shared with ${email} (${permission}) by user ${userId}`);

    return this.toResponse(share);
  }

  private async createLinkShare(
    noteId: string,
    userId: string,
    permission: string,
    password: string | null,
    expiresAt: string | null,
    token: string,
  ): Promise<NoteShareResponse> {
    const passwordHash = password ? this.hashPassword(password) : null;

    const share = await this.prisma.noteShare.create({
      data: {
        noteId,
        sharedBy: userId,
        sharedWith: null,
        permission: permission as 'VIEW' | 'COMMENT' | 'EDIT',
        token,
        passwordHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        sharedWithUser: { select: { email: true, displayName: true } },
      },
    });

    this.logger.log(`Share link created for note ${noteId} (${permission}) by user ${userId}`);

    return this.toResponse(share);
  }

  private async assertNoteExists(noteId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }
  }

  /**
   * Verify the user has permission to share the note (must be the
   * creator or a workspace OWNER/ADMIN/EDITOR).
   */
  private async assertUserCanShare(noteId: string, userId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { createdById: true, workspaceId: true },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }

    // Creator can always share
    if (note.createdById === userId) {
      return;
    }

    // Check workspace membership
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: note.workspaceId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this note');
    }

    // Only OWNER, ADMIN, and EDITOR can share
    if (membership.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot share notes');
    }
  }

  private async recordAccess(shareId: string): Promise<void> {
    await this.prisma.noteShare.update({
      where: { id: shareId },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  private toResponse(share: {
    id: string;
    noteId: string;
    sharedBy: string;
    sharedWith: string | null;
    permission: string;
    token: string;
    passwordHash: string | null;
    expiresAt: Date | null;
    accessCount: number;
    lastAccessedAt: Date | null;
    createdAt: Date;
    sharedWithUser?: { email: string; displayName: string } | null;
  }): NoteShareResponse {
    return {
      id: share.id,
      noteId: share.noteId,
      sharedBy: share.sharedBy,
      sharedWith: share.sharedWith,
      sharedWithEmail: share.sharedWithUser?.email ?? null,
      sharedWithName: share.sharedWithUser?.displayName ?? null,
      permission: share.permission as NoteShareResponse['permission'],
      token: share.token,
      hasPassword: share.passwordHash !== null,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      accessCount: share.accessCount,
      lastAccessedAt: share.lastAccessedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    };
  }
}
