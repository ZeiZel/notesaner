import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for installing a plugin from a GitHub repository release.
 *
 * Accepts the `owner/repo` format for the repository identifier,
 * an optional semver version pin, and an optional SHA-256 checksum
 * for verifying the downloaded asset.
 */
export class PluginInstallDto {
  @ApiProperty({
    description: 'GitHub repository in owner/repo format',
    example: 'notesaner/plugin-focus-mode',
  })
  @IsString()
  @MinLength(3, { message: 'repository must be at least 3 characters (e.g. a/b)' })
  @MaxLength(200, { message: 'repository must not exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, {
    message: 'repository must be in owner/repo format (e.g. notesaner/plugin-focus-mode)',
  })
  repository!: string;

  @ApiPropertyOptional({
    description: 'Specific semver version to install (defaults to latest release)',
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, {
    message: 'version must be a valid semver string (e.g. 1.2.0 or 1.0.0-beta.1)',
  })
  version?: string;

  @ApiPropertyOptional({
    description: 'Expected SHA-256 checksum of the release .zip asset (hex-encoded)',
    example: 'a1b2c3d4e5f6...',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'checksum must be a 64-character hex-encoded SHA-256 hash',
  })
  checksum?: string;

  @ApiPropertyOptional({
    description: 'Whether to enable automatic update checks for this plugin',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoUpdate?: boolean;
}
