import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type PublicNoteSortField = 'path' | 'title' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

/**
 * Query parameters for listing published notes in a public vault.
 */
export class PublicVaultQueryDto {
  @ApiPropertyOptional({ description: 'Opaque pagination cursor from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Max notes per page (1-100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['path', 'title', 'updatedAt'],
    default: 'path',
  })
  @IsOptional()
  @IsString()
  @IsIn(['path', 'title', 'updatedAt'], {
    message: 'sortBy must be one of: path, title, updatedAt',
  })
  sortBy?: PublicNoteSortField;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'sortDir must be "asc" or "desc"' })
  sortDir?: SortDirection;

  @ApiPropertyOptional({
    description: 'Restrict to notes under a folder prefix',
    example: 'projects',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'folder must not exceed 1000 characters' })
  folder?: string;
}
