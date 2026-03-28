import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchReplaceMode, SearchReplaceFiltersDto } from './search-replace-preview.dto';

// ---------------------------------------------------------------------------
// Single match reference (used for selective replacement)
// ---------------------------------------------------------------------------

export class MatchReferenceDto {
  @ApiProperty({ description: 'Note ID containing this match' })
  @IsUUID('4')
  noteId!: string;

  @ApiProperty({ description: 'Line number of the match (1-based)' })
  @IsInt()
  @Min(1)
  lineNumber!: number;

  @ApiProperty({ description: 'Column offset of the match within the line (0-based)' })
  @IsInt()
  @Min(0)
  columnOffset!: number;

  @ApiProperty({ description: 'The exact matched text' })
  @IsString()
  @MaxLength(10000)
  matchText!: string;
}

// ---------------------------------------------------------------------------
// Execute Replace DTO
// ---------------------------------------------------------------------------

export class SearchReplaceExecuteDto {
  @ApiProperty({
    description: 'Search query string (must match the query used for preview)',
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
    description: 'Filters to narrow the replacement scope',
    type: SearchReplaceFiltersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchReplaceFiltersDto)
  filters?: SearchReplaceFiltersDto;

  @ApiPropertyOptional({
    description:
      'Specific matches to replace. When omitted, replaces ALL matches in scope. ' +
      'When provided, only the listed matches are replaced.',
    type: [MatchReferenceDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchReferenceDto)
  matches?: MatchReferenceDto[];

  @ApiPropertyOptional({
    description: 'Note IDs to exclude from replacement',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeNoteIds?: string[];
}
