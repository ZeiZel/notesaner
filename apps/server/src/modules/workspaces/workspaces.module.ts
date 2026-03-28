import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceSwitchService } from './workspace-switch.service';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceSwitchService],
  exports: [WorkspacesService, WorkspaceSwitchService],
})
export class WorkspacesModule {}
