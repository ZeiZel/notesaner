/**
 * DTOs for Zettelkasten typed link relationships.
 */

import { IsHexColor, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({
    description: 'URL-safe slug (lowercase alphanumeric with hyphens)',
    example: 'my-custom-type',
    minLength: 2,
    maxLength: 64,
  })
  @IsString()
  @MinLength(2, { message: 'slug must be at least 2 characters' })
  @MaxLength(64, { message: 'slug must not exceed 64 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. my-type)',
  })
  slug!: string;

  @ApiProperty({
    description: 'Human-readable display label',
    example: 'My Custom Type',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'label must be at least 2 characters' })
  @MaxLength(100, { message: 'label must not exceed 100 characters' })
  label!: string;

  @ApiPropertyOptional({
    description: 'CSS hex color for visual distinction',
    example: '#6366f1',
    default: '#6366f1',
  })
  @IsOptional()
  @IsHexColor({ message: 'color must be a valid hex color (e.g. #3b82f6)' })
  color?: string;

  @ApiPropertyOptional({
    description: 'Description of the relationship semantics',
    example: 'Indicates that the source note contradicts the target note',
    maxLength: 500,
  })
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
  @ApiProperty({
    description: 'ID of the LinkRelationshipType to assign, or null to clear',
    example: 'abc-123-def',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  relationshipTypeId!: string | null;
}
