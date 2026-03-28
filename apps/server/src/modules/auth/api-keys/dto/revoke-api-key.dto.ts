import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Param DTO for revoking an API key by ID.
 * Validated via ParseUUIDPipe in the controller, but kept here for Swagger docs.
 */
export class RevokeApiKeyParamDto {
  @ApiProperty({
    description: 'API key ID to revoke (UUID)',
    example: 'b1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
  })
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id!: string;
}
