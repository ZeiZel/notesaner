import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum SortField {
  RELEVANCE = 'relevance',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum TagFilterMode {
  AND = 'AND',
  OR = 'OR',
}

export class SearchQueryDto {
  /**
   * Full-text search query string. Minimum 2 characters.
   */
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  /**
   * Opaque pagination cursor returned from the previous page response.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum number of results to return. Defaults to 20, maximum 100.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  // ─── Filters ─────────────────────────────────────────────────────────────

  /**
   * Filter by a single tag UUID. Supports multiple values when the query
   * parameter is repeated: ?tagIds=uuid1&tagIds=uuid2
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each tagId must be a valid UUID' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  tagIds?: string[];

  /**
   * Combine multiple tagIds with AND (note must have all tags) or OR
   * (note must have at least one tag). Defaults to OR.
   */
  @IsOptional()
  @IsEnum(TagFilterMode)
  tagMode?: TagFilterMode;

  /**
   * Filter notes by folder prefix (workspace-relative path, e.g. "projects").
   * Returns all notes whose path starts with this folder.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'folder path must not exceed 1000 characters' })
  folder?: string;

  /**
   * Return only notes created on or after this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'createdAfter must be a valid ISO 8601 date-time string' })
  createdAfter?: string;

  /**
   * Return only notes created on or before this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'createdBefore must be a valid ISO 8601 date-time string' })
  createdBefore?: string;

  /**
   * Return only notes updated on or after this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'updatedAfter must be a valid ISO 8601 date-time string' })
  updatedAfter?: string;

  /**
   * Return only notes updated on or before this ISO 8601 date-time.
   */
  @IsOptional()
  @IsDateString({}, { message: 'updatedBefore must be a valid ISO 8601 date-time string' })
  updatedBefore?: string;

  /**
   * Filter notes by the UUID of the user who created them.
   */
  @IsOptional()
  @IsUUID('4', { message: 'authorId must be a valid UUID' })
  authorId?: string;

  /**
   * Filter by published status.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isPublished?: boolean;

  /**
   * When true, include trashed notes in results. Defaults to false (exclude trash).
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isTrashed?: boolean;

  // ─── Sorting ─────────────────────────────────────────────────────────────

  /**
   * Field to sort by. Defaults to 'relevance' (FTS rank).
   * When 'relevance' is selected and no FTS results are available the
   * fallback is 'updatedAt DESC'.
   */
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField;

  /**
   * Sort direction. Defaults to 'desc'.
   */
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
