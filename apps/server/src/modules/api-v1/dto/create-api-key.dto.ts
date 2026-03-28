import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Permissions that can be granted to an API key.
 * Scoped to individual resource actions.
 */
export enum ApiKeyPermission {
  NOTES_READ = 'notes:read',
  NOTES_WRITE = 'notes:write',
  NOTES_DELETE = 'notes:delete',
  WEBHOOKS_READ = 'webhooks:read',
  WEBHOOKS_WRITE = 'webhooks:write',
  WEBHOOKS_DELETE = 'webhooks:delete',
}

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable name for the API key',
    example: 'CI/CD Pipeline Key',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Permissions granted to this key',
    type: [String],
    enum: ApiKeyPermission,
    example: ['notes:read', 'notes:write'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ApiKeyPermission, {
    each: true,
    message: 'each permission must be a valid ApiKeyPermission',
  })
  permissions?: ApiKeyPermission[];
}
