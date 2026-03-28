import { Module } from '@nestjs/common';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PublicSearchController } from './public-search.controller';
import { PublicSearchService } from './public-search.service';
import { PublicVaultController } from './public-vault.controller';
import { PublicVaultService } from './public-vault.service';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { DomainResolverMiddleware } from './domain-resolver.middleware';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ReaderCommentsService } from './reader-comments.service';
import {
  PublicReaderCommentsController,
  ReaderCommentsModerationController,
} from './reader-comments.controller';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    // FilesModule provides FilesService for reading note content from filesystem.
    // ValkeyModule is @Global() so ValkeyService is available without importing here.
    // PrismaModule is @Global() so PrismaService is available without importing here.
    FilesModule,
    // JobsModule provides JobsService for enqueuing email notifications on new comments.
    JobsModule,
  ],
  controllers: [
    PublishController,
    PublicSearchController,
    PublicVaultController,
    DomainController,
    AnalyticsController,
    PublicReaderCommentsController,
    ReaderCommentsModerationController,
  ],
  providers: [
    PublishService,
    PublicSearchService,
    PublicVaultService,
    DomainService,
    DomainResolverMiddleware,
    AnalyticsService,
    ReaderCommentsService,
  ],
  exports: [
    PublishService,
    PublicSearchService,
    PublicVaultService,
    DomainService,
    AnalyticsService,
    ReaderCommentsService,
  ],
})
export class PublishModule {}
