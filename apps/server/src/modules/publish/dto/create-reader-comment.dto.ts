import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a public reader comment on a published note.
 */
export class CreateReaderCommentDto {
  @ApiProperty({
    description: 'Comment body (plain text, max 2000 characters)',
    example: 'This is a great article! Very helpful.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString({ message: 'content must be a string' })
  @MinLength(1, { message: 'comment cannot be empty' })
  @MaxLength(2000, { message: 'comment must not exceed 2 000 characters' })
  content!: string;

  @ApiPropertyOptional({
    description: 'Display name for anonymous commenters',
    example: 'Bob',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'authorName must not exceed 100 characters' })
  authorName?: string;

  @ApiPropertyOptional({
    description: 'Email for reply notifications (not displayed publicly)',
    example: 'bob@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'authorEmail must be a valid email address' })
  @MaxLength(255)
  authorEmail?: string;

  @ApiPropertyOptional({
    description: 'Parent comment UUID for threaded replies (max 1 level deep)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Anti-spam honeypot field. Must be absent or empty string.',
    maxLength: 0,
  })
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'honeypot field must remain empty' })
  honeypot?: string;
}
