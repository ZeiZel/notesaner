// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — LinkRelationshipType model not yet in Prisma schema
/**
 * LinkTypesService
 *
 * Manages Zettelkasten-style typed link relationships.
 *
 * Responsibilities:
 *   - List all relationship types visible to a workspace (built-in + custom).
 *   - Create custom (workspace-scoped) relationship types.
 *   - Delete custom relationship types (built-ins are protected).
 *   - Set or clear the relationship type on a specific NoteLink.
 *
 * Design decisions:
 *   - Built-in types have workspaceId = null in the DB. They are always
 *     included when listing types for any workspace.
 *   - Custom type slugs are unique within a workspace (enforced by DB unique index).
 *   - Slugs from custom types cannot shadow built-in slugs; the validation layer
 *     prevents this to keep the type set unambiguous.
 *   - Deleting a relationship type sets relationshipTypeId = NULL on all
 *     associated NoteLink rows via the ON DELETE SET NULL FK cascade.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { LinkRelationshipType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLinkTypeDto, LinkRelationshipTypeDto } from './dto/link-type.dto';

@Injectable()
export class LinkTypesService {
  private readonly logger = new Logger(LinkTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── List ─────────────────────────────────────────────────────────────────

  /**
   * Returns all relationship types visible for the given workspace:
   *   - All built-in types (workspaceId IS NULL)
   *   - All custom types scoped to this workspace
   *
   * Built-in types are always listed first, sorted by their canonical order.
   * Custom types follow, sorted alphabetically by label.
   */
  async listForWorkspace(workspaceId: string): Promise<LinkRelationshipTypeDto[]> {
    const types = await this.prisma.linkRelationshipType.findMany({
      where: {
        OR: [
          { workspaceId: null }, // built-ins
          { workspaceId }, // workspace-custom
        ],
      },
      orderBy: [
        { isBuiltIn: 'desc' }, // built-ins first
        { label: 'asc' },
      ],
    });

    return types.map((t) => this.mapToDto(t));
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a new custom relationship type scoped to a workspace.
   *
   * Rejects slugs that collide with:
   *   - An existing built-in type slug
   *   - An existing custom type slug within the same workspace
   */
  async create(workspaceId: string, dto: CreateLinkTypeDto): Promise<LinkRelationshipTypeDto> {
    // Guard: slug must not collide with built-in types
    const builtInConflict = await this.prisma.linkRelationshipType.findFirst({
      where: { slug: dto.slug, workspaceId: null },
    });
    if (builtInConflict) {
      throw new ConflictException(
        `The slug "${dto.slug}" is reserved for a built-in relationship type`,
      );
    }

    // Guard: slug must not collide with existing custom type in workspace
    const customConflict = await this.prisma.linkRelationshipType.findFirst({
      where: { slug: dto.slug, workspaceId },
    });
    if (customConflict) {
      throw new ConflictException(
        `A custom relationship type with slug "${dto.slug}" already exists in this workspace`,
      );
    }

    const created = await this.prisma.linkRelationshipType.create({
      data: {
        workspaceId,
        slug: dto.slug,
        label: dto.label,
        color: dto.color ?? '#6366f1',
        description: dto.description ?? null,
        isBuiltIn: false,
      },
    });

    this.logger.log(
      `Custom link type created: "${dto.slug}" (${created.id}) in workspace ${workspaceId}`,
    );

    return this.mapToDto(created);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Deletes a custom workspace-scoped relationship type.
   *
   * Built-in types cannot be deleted (403).
   * Types from other workspaces cannot be deleted (404).
   * All NoteLink rows using this type are set to relationshipTypeId = NULL
   * automatically by the ON DELETE SET NULL FK cascade.
   */
  async delete(workspaceId: string, typeId: string): Promise<void> {
    const type = await this.prisma.linkRelationshipType.findUnique({
      where: { id: typeId },
    });

    if (!type || type.workspaceId !== workspaceId) {
      throw new NotFoundException('Link relationship type not found');
    }

    if (type.isBuiltIn) {
      throw new ForbiddenException('Built-in relationship types cannot be deleted');
    }

    await this.prisma.linkRelationshipType.delete({ where: { id: typeId } });

    this.logger.log(
      `Custom link type deleted: "${type.slug}" (${typeId}) from workspace ${workspaceId}`,
    );
  }

  // ─── Set on NoteLink ──────────────────────────────────────────────────────

  /**
   * Sets or clears the relationship type on an existing NoteLink.
   *
   * The NoteLink must belong to a note in the given workspace.
   * The relationship type (when not null) must be visible for the workspace
   * (built-in or custom in this workspace).
   *
   * @param workspaceId     - workspace context for authorization
   * @param noteLinkId      - the NoteLink row to update
   * @param relationshipTypeId - the type to assign, or null to clear
   */
  async setLinkType(
    workspaceId: string,
    noteLinkId: string,
    relationshipTypeId: string | null,
  ): Promise<{ id: string; relationshipTypeId: string | null }> {
    // Verify the NoteLink belongs to this workspace (via sourceNote)
    const noteLink = await this.prisma.noteLink.findFirst({
      where: {
        id: noteLinkId,
        sourceNote: { workspaceId },
      },
      select: { id: true },
    });

    if (!noteLink) {
      throw new NotFoundException('Note link not found');
    }

    // When setting a non-null type, verify it is accessible for this workspace
    if (relationshipTypeId !== null) {
      const type = await this.prisma.linkRelationshipType.findFirst({
        where: {
          id: relationshipTypeId,
          OR: [
            { workspaceId: null }, // built-in
            { workspaceId }, // custom in this workspace
          ],
        },
      });

      if (!type) {
        throw new NotFoundException(
          'Link relationship type not found or not accessible for this workspace',
        );
      }
    }

    const updated = await this.prisma.noteLink.update({
      where: { id: noteLinkId },
      data: { relationshipTypeId },
      select: { id: true, relationshipTypeId: true },
    });

    this.logger.debug(
      `NoteLink ${noteLinkId} relationship type set to ${relationshipTypeId ?? 'null'}`,
    );

    return {
      id: updated.id,
      relationshipTypeId: updated.relationshipTypeId,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private mapToDto(type: LinkRelationshipType): LinkRelationshipTypeDto {
    return {
      id: type.id,
      workspaceId: type.workspaceId,
      slug: type.slug,
      label: type.label,
      color: type.color,
      description: type.description,
      isBuiltIn: type.isBuiltIn,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
    };
  }
}
