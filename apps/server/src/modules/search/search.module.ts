import { Module, forwardRef } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchReplaceController } from './search-replace.controller';
import { SearchService } from './search.service';
import { SearchReplaceService } from './search-replace.service';
import { JobsModule } from '../jobs/jobs.module';
import { FilesModule } from '../files/files.module';
import { NotesModule } from '../notes/notes.module';

/**
 * SearchModule — provides full-text search, fuzzy search, recent-search
 * history backed by ValKey, and workspace-level search & replace.
 *
 * Both PrismaModule and ValkeyModule are @Global(), so their providers
 * (PrismaService, ValkeyService) are injected automatically without
 * explicitly importing them here.
 *
 * Uses forwardRef for NotesModule to break the circular dependency:
 * NotesModule -> SearchModule -> NotesModule (for VersionService).
 */
@Module({
  imports: [JobsModule, FilesModule, forwardRef(() => NotesModule)],
  controllers: [SearchController, SearchReplaceController],
  providers: [SearchService, SearchReplaceService],
  exports: [SearchService, SearchReplaceService],
})
export class SearchModule {}
