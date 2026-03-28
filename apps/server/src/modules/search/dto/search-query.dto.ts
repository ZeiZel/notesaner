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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({
    description: 'Full-text search query string (min 2 chars)',
    example: 'meeting notes',
    minLength: 2,
    maxLength: 500,
  })
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  @ApiPropertyOptional({ description: 'Opaque pagination cursor from previous response' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Max results per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  // ---- Filters ----

  @ApiPropertyOptional({
    description: 'Filter by tag UUIDs (repeat param for multiple)',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each tagId must be a valid UUID' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'Tag filter mode: AND (must have all tags) or OR (at least one)',
    enum: TagFilterMode,
    default: TagFilterMode.OR,
  })
  @IsOptional()
  @IsEnum(TagFilterMode)
  tagMode?: TagFilterMode;

  @ApiPropertyOptional({
    description: 'Filter by folder prefix path',
    example: 'projects',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'folder path must not exceed 1000 characters' })
  folder?: string;

  @ApiPropertyOptional({
    description: 'Notes created on or after (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'createdAfter must be a valid ISO 8601 date-time string' })
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Notes created on or before (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'createdBefore must be a valid ISO 8601 date-time string' })
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Notes updated on or after (ISO 8601)',
    example: '2024-06-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'updatedAfter must be a valid ISO 8601 date-time string' })
  updatedAfter?: string;

  @ApiPropertyOptional({
    description: 'Notes updated on or before (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'updatedBefore must be a valid ISO 8601 date-time string' })
  updatedBefore?: string;

  @ApiPropertyOptional({
    description: 'Filter by note creator UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'authorId must be a valid UUID' })
  authorId?: string;

  @ApiPropertyOptional({ description: 'Filter by published status', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Include trashed notes (default false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isTrashed?: boolean;

  // ---- Sorting ----

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: SortField,
    default: SortField.RELEVANCE,
  })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
