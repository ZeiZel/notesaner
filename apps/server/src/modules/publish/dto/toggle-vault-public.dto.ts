import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for toggling workspace public visibility.
 */
export class ToggleVaultPublicDto {
  @ApiProperty({
    description: 'Whether the workspace vault should be publicly accessible',
    example: true,
  })
  @IsBoolean({ message: 'isPublic must be a boolean' })
  isPublic!: boolean;

  @ApiPropertyOptional({
    description: 'URL-safe public slug (required when isPublic=true)',
    example: 'my-public-notes',
    minLength: 2,
    maxLength: 63,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'publicSlug must be at least 2 characters' })
  @MaxLength(63, { message: 'publicSlug must not exceed 63 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'publicSlug must be lowercase alphanumeric with hyphens (e.g. my-public-notes)',
  })
  publicSlug?: string;
}
