import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTE_INDEX_QUEUE } from './jobs.constants';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { NoteIndexingProcessor } from './processors/note-indexing.processor';

@Module({
  imports: [
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
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    {
      provide: NoteIndexingProcessor,
      useClass: NoteIndexingProcessor,
      // BullMQ worker concurrency
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
