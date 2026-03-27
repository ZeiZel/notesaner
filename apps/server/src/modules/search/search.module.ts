import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { JobsModule } from '../jobs/jobs.module';

/**
 * SearchModule — provides full-text search, fuzzy search, and recent-search
 * history backed by ValKey.
 *
 * Both PrismaModule and ValkeyModule are @Global(), so their providers
 * (PrismaService, ValkeyService) are injected automatically without
 * explicitly importing them here.
 */
@Module({
  imports: [JobsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
