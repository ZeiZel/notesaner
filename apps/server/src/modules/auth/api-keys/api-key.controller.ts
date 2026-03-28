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
import { UserApiKeyService } from './api-key.service';
import { CreateUserApiKeyDto } from './dto/create-api-key.dto';

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * UserApiKeyController -- CRUD endpoints for user-scoped API keys.
 *
 * All endpoints require JWT authentication (the user manages their own keys).
 * API keys provide an alternative authentication method for programmatic access
 * (CLI tools, CI/CD pipelines, integrations).
 *
 * Routes:
 *   POST   /api/keys     -- Create a new API key
 *   GET    /api/keys     -- List all active API keys for the current user
 *   DELETE /api/keys/:id -- Revoke an API key
 */
@ApiTags('API Keys')
@ApiBearerAuth('bearer')
@Controller('keys')
export class UserApiKeyController {
  constructor(private readonly apiKeyService: UserApiKeyService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Generates a new API key for the authenticated user. The full key is returned ' +
      'exactly once in the response -- store it securely. It cannot be retrieved later.',
  })
  @ApiBody({ type: CreateUserApiKeyDto })
  @ApiCreatedResponse({
    description: 'API key created. The full key is included in the response.',
  })
  @ApiBadRequestResponse({
    description: 'Validation error or maximum key limit reached.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserApiKeyDto) {
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
  @ApiOkResponse({ description: 'List of active API keys.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async list(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.list(user.sub);
  }

  // ── Revoke ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
