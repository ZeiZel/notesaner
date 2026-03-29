import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookService } from './webhook.service';

/**
 * WorkspaceWebhooksController
 *
 * Workspace-scoped CRUD for webhook subscriptions. Authenticated via JWT
 * (Bearer token) and workspace role guard. The workspaceId comes from the
 * route parameter so users can only manage webhooks in workspaces they
 * belong to.
 *
 * Routes:
 *   POST   /workspaces/:workspaceId/webhooks
 *   GET    /workspaces/:workspaceId/webhooks
 *   GET    /workspaces/:workspaceId/webhooks/:id
 *   PATCH  /workspaces/:workspaceId/webhooks/:id
 *   DELETE /workspaces/:workspaceId/webhooks/:id
 *   POST   /workspaces/:workspaceId/webhooks/:id/test
 */
@ApiTags('Webhooks')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
@Controller('workspaces/:workspaceId/webhooks')
export class WorkspaceWebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  @Roles('ADMIN', 'OWNER')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a webhook subscription',
    description:
      'Creates a new webhook subscription for the workspace. ' +
      'The response includes the raw secret — shown only once, not recoverable. ' +
      'Maximum 10 active webhooks per workspace. Requires ADMIN or OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiBody({ type: CreateWebhookDto })
  @ApiCreatedResponse({ description: 'Webhook created. Raw secret is included in the response.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Insufficient workspace role (requires ADMIN or OWNER).' })
  async create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateWebhookDto) {
    return this.webhookService.create(workspaceId, dto);
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get()
  @ApiOperation({
    summary: 'List webhook subscriptions',
    description:
      'Returns all active webhook subscriptions for the workspace. ' +
      'Secrets are never included in list responses. Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiOkResponse({ description: 'List of webhooks (secrets masked).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Not a member of this workspace.' })
  async list(@Param('workspaceId') workspaceId: string) {
    return this.webhookService.list(workspaceId);
  }

  // ─── Get single with stats ─────────────────────────────────────────────────

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get(':id')
  @ApiOperation({
    summary: 'Get a webhook with delivery statistics',
    description:
      'Returns the webhook details plus aggregated delivery statistics ' +
      '(total, successful, failed deliveries and timestamp of the last attempt). ' +
      'Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Webhook details with delivery statistics.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        workspaceId: { type: 'string', format: 'uuid' },
        url: { type: 'string' },
        events: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
        failureCount: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        deliveryStats: {
          type: 'object',
          properties: {
            totalDeliveries: { type: 'integer' },
            successfulDeliveries: { type: 'integer' },
            failedDeliveries: { type: 'integer' },
            lastDeliveryAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Not a member of this workspace.' })
  async findOne(@Param('workspaceId') workspaceId: string, @Param('id') webhookId: string) {
    return this.webhookService.findByIdWithStats(workspaceId, webhookId);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  @Roles('ADMIN', 'OWNER')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a webhook subscription',
    description:
      'Partially updates a webhook subscription. Accepted fields: url, events, active. ' +
      'Setting active=true resets the failure counter. Requires ADMIN or OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiBody({ type: UpdateWebhookDto })
  @ApiOkResponse({ description: 'Webhook updated. Returns the updated webhook.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Insufficient workspace role (requires ADMIN or OWNER).' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(workspaceId, webhookId, dto);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  @Roles('ADMIN', 'OWNER')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a webhook subscription',
    description:
      'Deactivates (soft-deletes) the webhook. Delivery records are retained for audit. ' +
      'Requires ADMIN or OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiNoContentResponse({ description: 'Webhook deactivated.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Insufficient workspace role (requires ADMIN or OWNER).' })
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') webhookId: string) {
    await this.webhookService.delete(workspaceId, webhookId);
  }

  // ─── Test delivery ────────────────────────────────────────────────────────

  @Roles('ADMIN', 'OWNER')
  @Post(':id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a test webhook event',
    description:
      'Enqueues a synthetic test payload to verify connectivity with the webhook URL. ' +
      'Returns the delivery ID which can be used to track the result via the delivery history endpoint. ' +
      'Requires ADMIN or OWNER role.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiOkResponse({
    description: 'Test event enqueued. Use the deliveryId to track the result.',
    schema: {
      type: 'object',
      properties: {
        deliveryId: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Insufficient workspace role (requires ADMIN or OWNER).' })
  async sendTest(@Param('workspaceId') workspaceId: string, @Param('id') webhookId: string) {
    const result = await this.webhookService.sendTestEvent(workspaceId, webhookId);
    return {
      ...result,
      message: 'Test event enqueued for delivery. Check delivery history for the result.',
    };
  }

  // ─── Delivery history ──────────────────────────────────────────────────────

  @Roles('VIEWER', 'EDITOR', 'ADMIN', 'OWNER')
  @Get(':id/deliveries')
  @ApiOperation({
    summary: 'List webhook delivery history',
    description:
      'Returns delivery history for the webhook (last 100 by default, max 200). ' +
      'Includes HTTP status codes, response times, attempt counts, and timestamps. ' +
      'Minimum role: VIEWER.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID (UUID)', type: String })
  @ApiParam({ name: 'id', description: 'Webhook ID (UUID)', type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of results to return (1-200, default 100)',
  })
  @ApiOkResponse({
    description: 'Delivery history with status codes, response times, and attempt counts.',
  })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Not a member of this workspace.' })
  async listDeliveries(
    @Param('workspaceId') workspaceId: string,
    @Param('id') webhookId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookService.listDeliveries(
      workspaceId,
      webhookId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
