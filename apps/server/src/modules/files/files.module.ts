import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesService } from './files.service';
import { AttachmentService } from './attachment.service';
import { AttachmentController, PublicAttachmentController } from './attachment.controller';
import { ImageOptimizerService } from './image-optimizer.service';
import { ImageOptimizerProcessor } from './image-optimizer.processor';
import { ImageServeService } from './image-serve.service';
import { IMAGE_OPTIMIZE_QUEUE } from './image-optimizer.constants';

// PrismaModule is @Global() — PrismaService is available everywhere without importing here.
// BullModule.forRootAsync is registered globally in JobsModule (loaded first in AppModule).
// We only need to declare the queue itself.

@Module({
  imports: [
    BullModule.registerQueue({
      name: IMAGE_OPTIMIZE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    }),
  ],
  controllers: [AttachmentController, PublicAttachmentController],
  providers: [
    FilesService,
    AttachmentService,
    ImageOptimizerService,
    ImageServeService,
    {
      provide: ImageOptimizerProcessor,
      useClass: ImageOptimizerProcessor,
    },
  ],
  exports: [FilesService, AttachmentService, ImageOptimizerService],
})
export class FilesModule {}
