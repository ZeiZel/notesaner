import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { FoldersController } from './folders.controller';
import { BrokenLinksController } from './broken-links.controller';
import { ShareController, PublicShareController } from './share.controller';
import { CommentsController } from './comments.controller';
import { FreshnessController } from './freshness.controller';
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
import { GuestNoteGuard } from '../../common/guards/guest-note.guard';
import { FilesModule } from '../files/files.module';
import { SearchModule } from '../search/search.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [FilesModule, SearchModule, JobsModule],
  controllers: [
    NotesController,
    FoldersController,
    BrokenLinksController,
    ShareController,
    PublicShareController,
    CommentsController,
    FreshnessController,
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
  ],
})
export class NotesModule {}
