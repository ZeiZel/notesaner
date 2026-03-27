import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [NotesController, CommentsController],
  providers: [NotesService, CommentsService],
  exports: [NotesService, CommentsService],
})
export class NotesModule {}
