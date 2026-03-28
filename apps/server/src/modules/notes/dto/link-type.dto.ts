/**
 * DTOs for Zettelkasten typed link relationships.
 *
 * A "relationship type" (e.g. "relates-to", "contradicts") is a semantic
 * annotation layered on top of the structural link type (WIKI / MARKDOWN / EMBED).
 * Built-in types are workspace-independent; custom types are scoped to a workspace.
 */

import { IsHexColor, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * A link relationship type as returned by the API.
 * Built-in types have workspaceId = null.
 */
export interface LinkRelationshipTypeDto {
  id: string;
  workspaceId: string | null;
  slug: string;
  label: string;
  color: string;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/**
 * Body for POST /workspaces/:workspaceId/link-types
 * Creates a custom (workspace-scoped) relationship type.
 */
export class CreateLinkTypeDto {
  /**
   * URL-safe identifier for the type (e.g. "my-custom-type").
   * Must be 2–64 lowercase alphanumeric characters and hyphens.
   */
  @IsString()
  @MinLength(2, { message: 'slug must be at least 2 characters' })
  @MaxLength(64, { message: 'slug must not exceed 64 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. my-type)',
  })
  slug!: string;

  /** Human-readable display label (e.g. "My Custom Type"). */
  @IsString()
  @MinLength(2, { message: 'label must be at least 2 characters' })
  @MaxLength(100, { message: 'label must not exceed 100 characters' })
  label!: string;

  /**
   * CSS hex color string used for visual distinction in the editor and graph.
   * Defaults to indigo (#6366f1) when omitted.
   */
  @IsOptional()
  @IsHexColor({ message: 'color must be a valid hex color (e.g. #3b82f6)' })
  color?: string;

  /** Optional description of the relationship semantics. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string;
}

/**
 * Body for PATCH /workspaces/:workspaceId/note-links/:id/type
 * Sets or clears the relationship type on an existing NoteLink row.
 */
export class SetLinkTypeDto {
  /**
   * ID of the LinkRelationshipType to assign.
   * Pass null to clear the relationship type (revert to untyped).
   */
  @IsOptional()
  @IsString()
  relationshipTypeId!: string | null;
}
