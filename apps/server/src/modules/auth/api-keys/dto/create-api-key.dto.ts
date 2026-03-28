import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Scopes that can be granted to a user-level API key.
 *
 * - READ  — read-only access to notes, workspaces, and user profile
 * - WRITE — read + create/update notes, manage workspaces
 * - ADMIN — full access including user settings, API key management
 */
export enum UserApiKeyScope {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

export class CreateUserApiKeyDto {
  @ApiProperty({
    description: 'Human-readable name for the API key',
    example: 'CLI Tool',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Scopes granted to this key. Defaults to [read] if omitted.',
    type: [String],
    enum: UserApiKeyScope,
    example: ['read', 'write'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserApiKeyScope, {
    each: true,
    message: 'each scope must be one of: read, write, admin',
  })
  scopes?: UserApiKeyScope[];

  @ApiPropertyOptional({
    description: 'Expiration date in ISO 8601 format. If omitted, the key never expires.',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'expiresAt must be a valid ISO 8601 date' })
  expiresAt?: string;
}
