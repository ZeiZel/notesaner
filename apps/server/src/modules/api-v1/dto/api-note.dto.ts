import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiCreateNoteDto {
  @ApiProperty({
    description: 'Workspace-relative file path (e.g. "journal/2024-01-15.md")',
    example: 'journal/2024-01-15.md',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1, { message: 'path must not be empty' })
  @MaxLength(500, { message: 'path must not exceed 500 characters' })
  path!: string;

  @ApiProperty({
    description: 'Note title',
    example: 'Daily Journal Entry',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1, { message: 'title must not be empty' })
  @MaxLength(500, { message: 'title must not exceed 500 characters' })
  title!: string;

  @ApiPropertyOptional({
    description: 'Initial markdown content',
    example: '# My Note\n\nSome content here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000, { message: 'content must not exceed 10 MB' })
  content?: string;
}

export class ApiUpdateNoteDto {
  @ApiPropertyOptional({
    description: 'Updated title',
    example: 'Revised Title',
    minLength: 1,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'title must not be empty' })
  @MaxLength(500, { message: 'title must not exceed 500 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated markdown content',
    example: '# Updated\n\nNew content.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000, { message: 'content must not exceed 10 MB' })
  content?: string;

  @ApiPropertyOptional({
    description: 'YAML frontmatter key-value pairs',
    example: { tags: ['project'], status: 'published' },
  })
  @IsOptional()
  @IsObject()
  frontmatter?: Record<string, unknown>;
}
