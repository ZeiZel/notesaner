import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  FRESHNESS_CHECK_QUEUE,
  NOTE_INDEX_QUEUE,
  STORAGE_RECALCULATION_QUEUE,
  TRASH_PURGE_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
} from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { NoteIndexingProcessor } from './processors/note-indexing.processor';
import { FreshnessCheckProcessor } from './processors/freshness-check.processor';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';
import { StorageRecalculationProcessor } from './processors/storage-recalculation.processor';
import { TrashPurgeProcessor } from './processors/trash-purge.processor';
import { EmailModule } from '../email/email.module';
import { NotesModule } from '../notes/notes.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    EmailModule,
    // Use forwardRef to break the circular dependency: NotesModule -> JobsModule -> NotesModule
    forwardRef(() => NotesModule),
    WorkspacesModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          db: config.get<number>('redis.db'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: NOTE_INDEX_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    }),
    BullModule.registerQueue({
      name: FRESHNESS_CHECK_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 60_000 },
      },
    }),
    BullModule.registerQueue({
      name: WEBHOOK_DELIVERY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
      },
    }),
    BullModule.registerQueue({
      name: STORAGE_RECALCULATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 60_000 },
      },
    }),
    BullModule.registerQueue({
      name: TRASH_PURGE_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 30_000 },
      },
    }),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    {
      provide: NoteIndexingProcessor,
      useClass: NoteIndexingProcessor,
    },
    {
      provide: FreshnessCheckProcessor,
      useClass: FreshnessCheckProcessor,
    },
    {
      provide: WebhookDeliveryProcessor,
      useClass: WebhookDeliveryProcessor,
    },
    {
      provide: StorageRecalculationProcessor,
      useClass: StorageRecalculationProcessor,
    },
    {
      provide: TrashPurgeProcessor,
      useClass: TrashPurgeProcessor,
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
