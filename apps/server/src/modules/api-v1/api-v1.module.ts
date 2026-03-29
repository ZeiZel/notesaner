import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotesModule } from '../notes/notes.module';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './api-key.guard';
import { WebhookService } from './webhook.service';
import { ApiV1NotesController } from './api-v1-notes.controller';
import { WebhookController } from './webhook.controller';
import { WorkspaceWebhooksController } from './workspace-webhooks.controller';

/**
 * ApiV1Module — public REST API with API key authentication and webhook delivery.
 *
 * Features:
 *   - Versioned routes under /api/v1/*
 *   - API key authentication via X-API-Key header
 *   - Full CRUD for notes, scoped to the API key's workspace
 *   - Webhook subscriptions with HMAC-SHA256 signed payloads
 *   - Webhook delivery via background job queue (3 attempts, exponential back-off)
 *   - Workspace-scoped webhook CRUD under /workspaces/:workspaceId/webhooks (JWT auth)
 */
@Module({
  imports: [PrismaModule, FilesModule, NotesModule, JobsModule],
  controllers: [ApiV1NotesController, WebhookController, WorkspaceWebhooksController],
  providers: [ApiKeyService, ApiKeyGuard, WebhookService],
  exports: [ApiKeyService, WebhookService],
})
export class ApiV1Module {}
