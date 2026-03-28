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
