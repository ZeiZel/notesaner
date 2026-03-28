import { Module, forwardRef } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { FoldersController } from './folders.controller';
import { BrokenLinksController } from './broken-links.controller';
import { ShareController, PublicShareController } from './share.controller';
import { CommentsController } from './comments.controller';
import { FreshnessController } from './freshness.controller';
import { BlockReferencesController } from './block-references.controller';
import { ExportController } from './export.controller';
import { ImportController } from './import.controller';
import { NotesService } from './notes.service';
import { VersionService } from './version.service';
import { FrontmatterService } from './frontmatter.service';
import { FileWatcherService } from './file-watcher.service';
import { LinkExtractionService } from './link-extraction.service';
import { BrokenLinksService } from './broken-links.service';
import { ShareService } from './share.service';
import { CommentsService } from './comments.service';
import { ContentHashService } from './content-hash.service';
import { FreshnessService } from './freshness.service';
import { BlockReferencesService } from './block-references.service';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { GuestNoteGuard } from '../../common/guards/guest-note.guard';
import { FilesModule } from '../files/files.module';
import { SearchModule } from '../search/search.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [FilesModule, SearchModule, forwardRef(() => JobsModule)],
  controllers: [
    NotesController,
    FoldersController,
    BrokenLinksController,
    ShareController,
    PublicShareController,
    CommentsController,
    FreshnessController,
    BlockReferencesController,
    ExportController,
    ImportController,
  ],
  providers: [
    NotesService,
    VersionService,
    FrontmatterService,
    FileWatcherService,
    LinkExtractionService,
    BrokenLinksService,
    ShareService,
    CommentsService,
    ContentHashService,
    FreshnessService,
    BlockReferencesService,
    ExportService,
    ImportService,
    GuestNoteGuard,
  ],
  exports: [
    NotesService,
    VersionService,
    FrontmatterService,
    LinkExtractionService,
    BrokenLinksService,
    ShareService,
    CommentsService,
    ContentHashService,
    FreshnessService,
    BlockReferencesService,
    ExportService,
    ImportService,
  ],
})
export class NotesModule {}
