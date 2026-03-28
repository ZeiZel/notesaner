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
import { ApiKeyGuard, getApiKey, RequestWithApiKey } from './api-key.guard';
import { ApiKeyService } from './api-key.service';
import { ApiKeyPermission } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhookService } from './webhook.service';

/**
 * WebhookController — CRUD for webhook subscriptions and delivery history.
 *
 * Routes:
 *   POST   /api/v1/webhooks                      Create webhook
 *   GET    /api/v1/webhooks                      List webhooks
 *   DELETE /api/v1/webhooks/:id                  Delete (deactivate) webhook
 *   GET    /api/v1/webhooks/:id/deliveries        List delivery history
 */
@UseGuards(ApiKeyGuard)
@Controller('api/v1/webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  /**
   * POST /api/v1/webhooks
   *
   * Create a new webhook subscription.
   * The response includes the raw secret — it will never be returned again.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: RequestWithApiKey, @Body() dto: CreateWebhookDto) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_WRITE);

    return this.webhookService.create(apiKey.workspaceId, dto);
  }

  /**
   * GET /api/v1/webhooks
   *
   * List all active webhook subscriptions for the workspace.
   */
  @Get()
  async list(@Req() req: RequestWithApiKey) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_READ);

    return this.webhookService.list(apiKey.workspaceId);
  }

  /**
   * DELETE /api/v1/webhooks/:id
   *
   * Deactivate a webhook. Delivery records are retained for audit.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: RequestWithApiKey, @Param('id') webhookId: string) {
    const apiKey = getApiKey(req);
    this.apiKeyService.assertPermission(apiKey, ApiKeyPermission.WEBHOOKS_DELETE);

    await this.webhookService.delete(apiKey.workspaceId, webhookId);
  }

  /**
   * GET /api/v1/webhooks/:id/deliveries
   *
   * List delivery history for a webhook.
   *
   * Query params:
   *   - limit: max results (1-200, default 50)
   */
  @Get(':id/deliveries')
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
