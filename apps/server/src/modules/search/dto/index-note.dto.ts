import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IndexNoteDto {
  @ApiProperty({
    description: 'Note title',
    example: 'Meeting Notes 2024-01',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiProperty({
    description: 'Full text content of the note',
    example: '# Meeting Notes\n\nDiscussion about Q4 roadmap...',
  })
  @IsString()
  @MaxLength(1_000_000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Tags associated with the note',
    type: [String],
    example: ['meeting', 'q4', 'roadmap'],
  })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'YAML frontmatter key-value pairs',
    example: { status: 'published', category: 'meetings' },
  })
  @IsOptional()
  @IsObject()
  frontmatter?: Record<string, unknown>;
}
