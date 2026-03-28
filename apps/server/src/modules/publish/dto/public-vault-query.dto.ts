import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Sort field options for public note listings.
 */
export type PublicNoteSortField = 'path' | 'title' | 'updatedAt';

/**
 * Sort direction options.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Query parameters for listing published notes in a public vault.
 *
 * Supports cursor-based pagination and server-side sorting.
 */
export class PublicVaultQueryDto {
  /**
   * Opaque pagination cursor returned by the previous page response.
   * When omitted, the first page is returned.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum number of notes to return per page.
   * Defaults to 20, capped at 100.
   */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;

  /**
   * Field to sort notes by.
   * Accepts: "path" | "title" | "updatedAt". Defaults to "path".
   */
  @IsOptional()
  @IsString()
  @IsIn(['path', 'title', 'updatedAt'], {
    message: 'sortBy must be one of: path, title, updatedAt',
  })
  sortBy?: PublicNoteSortField;

  /**
   * Sort direction: "asc" (default) or "desc".
   */
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'sortDir must be "asc" or "desc"' })
  sortDir?: SortDirection;

  /**
   * Restrict listing to notes under a specific folder prefix.
   * For example, "projects" returns only notes whose path begins with "projects/".
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'folder must not exceed 1000 characters' })
  folder?: string;
}
