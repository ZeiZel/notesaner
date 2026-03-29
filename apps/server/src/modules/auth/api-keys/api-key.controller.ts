import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { Audited } from '../../audit/audit.decorator';
import { AuditInterceptor } from '../../audit/audit.interceptor';
import { AuditAction } from '../../audit/audit.types';
import { UserApiKeyService } from './api-key.service';
import { CreateUserApiKeyDto } from './dto/create-api-key.dto';
import {
  CreatedApiKeyResponseDto,
  RotatedApiKeyResponseDto,
  UserApiKeyResponseDto,
} from './dto/list-api-keys.dto';

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * UserApiKeyController -- CRUD endpoints for user-scoped API keys.
 *
 * All endpoints require JWT authentication (the user manages their own keys).
 * API keys provide an alternative authentication method for programmatic access
 * (CLI tools, CI/CD pipelines, integrations).
 *
 * Routes:
 *   POST   /api/keys            -- Create a new API key
 *   GET    /api/keys            -- List all active API keys for the current user
 *   GET    /api/keys/:id        -- Get a single API key by ID
 *   POST   /api/keys/:id/rotate -- Rotate a key (creates replacement, revokes old)
 *   DELETE /api/keys/:id        -- Revoke an API key
 */
@ApiTags('API Keys')
@ApiBearerAuth('bearer')
@Controller('keys')
@UseInterceptors(AuditInterceptor)
export class UserApiKeyController {
  constructor(private readonly apiKeyService: UserApiKeyService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audited(AuditAction.API_KEY_CREATED)
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Generates a new API key for the authenticated user. The full key is returned ' +
      'exactly once in the response -- store it securely. It cannot be retrieved later.',
  })
  @ApiBody({ type: CreateUserApiKeyDto })
  @ApiCreatedResponse({
    description: 'API key created. The full key is included in the response.',
    type: CreatedApiKeyResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or maximum key limit reached.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserApiKeyDto,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeyService.create(user.sub, dto);
  }

  // ── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all active API keys',
    description:
      'Returns all non-revoked API keys for the authenticated user. ' +
      'The raw key value is never returned in list results -- only the prefix.',
  })
  @ApiOkResponse({ description: 'List of active API keys.', type: [UserApiKeyResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async list(@CurrentUser() user: JwtPayload): Promise<UserApiKeyResponseDto[]> {
    return this.apiKeyService.list(user.sub);
  }

  // ── Get by ID ───────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single API key by ID',
    description:
      'Returns the metadata and usage stats of a specific API key. ' +
      'The raw key value is never returned -- only the prefix.',
  })
  @ApiParam({ name: 'id', description: 'API key ID (UUID)', type: String })
  @ApiOkResponse({ description: 'API key details.', type: UserApiKeyResponseDto })
  @ApiNotFoundResponse({ description: 'API key not found or already revoked.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserApiKeyResponseDto> {
    return this.apiKeyService.getById(user.sub, id);
  }

  // ── Rotate ──────────────────────────────────────────────────────────────────

  @Post(':id/rotate')
  @HttpCode(HttpStatus.CREATED)
  @Audited(AuditAction.API_KEY_ROTATED)
  @ApiOperation({
    summary: 'Rotate an API key',
    description:
      'Creates a new replacement API key with the same name and scopes as the old key, ' +
      "then immediately revokes the old key. The new key's raw value is returned exactly once -- " +
      'store it securely. The old key stops working immediately after rotation.',
  })
  @ApiParam({ name: 'id', description: 'API key ID to rotate (UUID)', type: String })
  @ApiCreatedResponse({
    description: 'Key rotated. New key raw value is included; old key is now revoked.',
    type: RotatedApiKeyResponseDto,
  })
  @ApiNotFoundResponse({ description: 'API key not found or already revoked.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async rotate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RotatedApiKeyResponseDto> {
    return this.apiKeyService.rotate(user.sub, id);
  }

  // ── Revoke ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited(AuditAction.API_KEY_REVOKED)
  @ApiOperation({
    summary: 'Revoke an API key',
    description:
      'Soft-deletes an API key by marking it as revoked. ' +
      'The key will immediately stop working for authentication.',
  })
  @ApiParam({
    name: 'id',
    description: 'API key ID (UUID)',
    type: String,
  })
  @ApiNoContentResponse({ description: 'API key revoked successfully.' })
  @ApiNotFoundResponse({
    description: 'API key not found or already revoked.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async revoke(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.apiKeyService.revoke(user.sub, id);
  }
}
