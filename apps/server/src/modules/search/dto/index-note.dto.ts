import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IndexNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(1_000_000)
  content!: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  frontmatter?: Record<string, unknown>;
}
