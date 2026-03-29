import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserApiKeyScope } from './create-api-key.dto';

/**
 * Response DTO for listing API keys.
 * Never includes the raw key -- only the prefix for identification.
 */
export class UserApiKeyResponseDto {
  @ApiProperty({ description: 'API key ID (UUID)', example: 'b1c2d3e4-...' })
  id!: string;

  @ApiProperty({ description: 'Human-readable name', example: 'CLI Tool' })
  name!: string;

  @ApiProperty({
    description: 'First 8 characters of the key for identification',
    example: 'nts_a1b2',
  })
  prefix!: string;

  @ApiProperty({
    description: 'Granted scopes',
    type: [String],
    enum: UserApiKeyScope,
    example: ['read', 'write'],
  })
  scopes!: UserApiKeyScope[];

  @ApiPropertyOptional({
    description: 'Expiration date (null if the key never expires)',
    example: '2027-01-01T00:00:00.000Z',
  })
  expiresAt!: string | null;

  @ApiPropertyOptional({
    description: 'When the key was last used (null if never)',
    example: '2026-03-28T10:00:00.000Z',
  })
  lastUsedAt!: string | null;

  @ApiProperty({
    description: 'Total number of successful requests made with this key',
    example: 42,
  })
  requestCount!: number;

  @ApiProperty({
    description: 'When the key was created',
    example: '2026-03-28T09:00:00.000Z',
  })
  createdAt!: string;
}

/**
 * Response DTO returned only at creation time -- includes the full raw key.
 */
export class CreatedApiKeyResponseDto extends UserApiKeyResponseDto {
  @ApiProperty({
    description: 'The full API key. This is the ONLY time it will be shown. Store it securely.',
    example: 'nts_aB3dEf7gHi9jKlMnOpQrStUvWxYz012345678',
  })
  key!: string;
}

/**
 * Response DTO returned when a key is rotated.
 *
 * Contains both the old key's ID (now revoked) and the new replacement key
 * (with raw value exposed exactly once). Store the new key immediately.
 */
export class RotatedApiKeyResponseDto {
  @ApiProperty({ description: 'The rotated (now revoked) key ID', example: 'b1c2d3e4-...' })
  revokedKeyId!: string;

  @ApiProperty({
    description:
      'The new replacement API key. Store the raw key securely -- it will not be shown again.',
    type: () => CreatedApiKeyResponseDto,
  })
  newKey!: CreatedApiKeyResponseDto;
}
