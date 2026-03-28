import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApiCreateNoteDto {
  /**
   * Workspace-relative file path (e.g. "journal/2024-01-15.md").
   * Must not contain path traversal sequences.
   */
  @IsString()
  @MinLength(1, { message: 'path must not be empty' })
  @MaxLength(500, { message: 'path must not exceed 500 characters' })
  path!: string;

  @IsString()
  @MinLength(1, { message: 'title must not be empty' })
  @MaxLength(500, { message: 'title must not exceed 500 characters' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000_000, { message: 'content must not exceed 10 MB' })
  content?: string;
}

export class ApiUpdateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'title must not be empty' })
  @MaxLength(500, { message: 'title must not exceed 500 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000_000, { message: 'content must not exceed 10 MB' })
  content?: string;

  @IsOptional()
  @IsObject()
  frontmatter?: Record<string, unknown>;
}
