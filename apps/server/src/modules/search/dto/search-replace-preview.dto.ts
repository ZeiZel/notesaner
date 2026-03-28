import { Transform, Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SearchReplaceMode {
  PLAIN = 'plain',
  REGEX = 'regex',
}

// ---------------------------------------------------------------------------
// Filters sub-DTO
// ---------------------------------------------------------------------------

export class SearchReplaceFiltersDto {
  @ApiPropertyOptional({
    description: 'Restrict search to a specific folder path prefix',
    example: 'projects/frontend',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'folder path must not exceed 1000 characters' })
  folder?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag UUIDs',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each tagId must be a valid UUID' })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by file extension (without dot)',
    example: 'md',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  fileExtension?: string;

  @ApiPropertyOptional({
    description: 'Notes updated on or after (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
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
}

// ---------------------------------------------------------------------------
// Preview Request DTO
// ---------------------------------------------------------------------------

export class SearchReplacePreviewDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'TODO',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(1, { message: 'query must be at least 1 character' })
  @MaxLength(1000, { message: 'query must not exceed 1000 characters' })
  query!: string;

  @ApiProperty({
    description: 'Replacement text',
    example: 'DONE',
    maxLength: 10000,
  })
  @IsString()
  @MaxLength(10000, { message: 'replacement must not exceed 10000 characters' })
  replacement!: string;

  @ApiPropertyOptional({
    description: 'Search mode',
    enum: SearchReplaceMode,
    default: SearchReplaceMode.PLAIN,
  })
  @IsOptional()
  @IsEnum(SearchReplaceMode)
  mode?: SearchReplaceMode;

  @ApiPropertyOptional({
    description: 'Case-sensitive search (default false)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  caseSensitive?: boolean;

  @ApiPropertyOptional({
    description: 'Whole word matching (default false)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  wholeWord?: boolean;

  @ApiPropertyOptional({
    description: 'Filters to narrow the search scope',
    type: SearchReplaceFiltersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchReplaceFiltersDto)
  filters?: SearchReplaceFiltersDto;

  @ApiPropertyOptional({
    description: 'Maximum matches to return (default 500, max 5000)',
    default: 500,
    minimum: 1,
    maximum: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  maxMatches?: number;
}
