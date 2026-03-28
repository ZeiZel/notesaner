import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard, getApiKey, RequestWithApiKey } from './api-key.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyPermission } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhookService } from './webhook.service';

/**
 * WebhookController -- CRUD for webhook subscriptions and delivery history.
 */
@ApiTags('API v1 - Webhooks')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/v1/webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a webhook subscription',
    description:
      'Creates a new webhook subscription. The response includes the raw secret (shown only once). ' +
      'Requires webhooks:write permission.',
  })
  @ApiBody({ type: CreateWebhookDto })
  @ApiCreatedResponse({ description: 'Webhook created. Secret is returned in the response.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks webhooks:write permission.' })
  async create(@Req() req: RequestWithApiKey, @Body() dto: CreateWebhookDto) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_WRITE);

    return this.webhookService.create(apiKey.workspaceId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List webhook subscriptions',
    description:
      'Lists all active webhook subscriptions for the workspace. Requires webhooks:read permission.',
  })
  @ApiOkResponse({ description: 'List of webhooks (secrets are masked).' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks webhooks:read permission.' })
  async list(@Req() req: RequestWithApiKey) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_READ);

    return this.webhookService.list(apiKey.workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a webhook subscription',
    description:
      'Deactivates a webhook. Delivery records are retained for audit. Requires webhooks:delete permission.',
  })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Webhook deactivated.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks webhooks:delete permission.' })
  async delete(@Req() req: RequestWithApiKey, @Param('id') webhookId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_DELETE);

    await this.webhookService.delete(apiKey.workspaceId, webhookId);
  }

  @Get(':id/deliveries')
  @ApiOperation({
    summary: 'List webhook delivery history',
    description: 'Returns delivery history for a webhook. Requires webhooks:read permission.',
  })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results (1-200, default 50)',
  })
  @ApiOkResponse({ description: 'Delivery history with status codes and timestamps.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key.' })
  @ApiForbiddenResponse({ description: 'API key lacks webhooks:read permission.' })
  async listDeliveries(
    @Req() req: RequestWithApiKey,
    @Param('id') webhookId: string,
    @Query('limit') limit?: string,
  ) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_READ);

    return this.webhookService.listDeliveries(
      apiKey.workspaceId,
      webhookId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
