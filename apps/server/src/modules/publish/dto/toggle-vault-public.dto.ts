import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for toggling workspace public visibility.
 *
 * When isPublic is true, publicSlug must be provided to establish the
 * public vault URL. When isPublic is false the vault is taken offline
 * but the publicSlug is preserved so re-enabling reuses the same URL.
 */
export class ToggleVaultPublicDto {
  /**
   * Whether the workspace vault should be publicly accessible.
   */
  @IsBoolean({ message: 'isPublic must be a boolean' })
  isPublic!: boolean;

  /**
   * URL-safe public slug for the vault (e.g. "my-public-notes").
   * Required when isPublic is true.
   * Must be lowercase alphanumeric with hyphens, 2–63 characters.
   */
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'publicSlug must be at least 2 characters' })
  @MaxLength(63, { message: 'publicSlug must not exceed 63 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'publicSlug must be lowercase alphanumeric with hyphens (e.g. my-public-notes)',
  })
  publicSlug?: string;
}
