import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceSwitchService } from './workspace-switch.service';
import { StorageQuotaService } from './storage-quota.service';
import { StorageQuotaController } from './storage-quota.controller';

@Module({
  imports: [AuditModule],
  controllers: [WorkspacesController, StorageQuotaController],
  providers: [WorkspacesService, WorkspaceSwitchService, StorageQuotaService],
  exports: [WorkspacesService, WorkspaceSwitchService, StorageQuotaService],
})
export class WorkspacesModule {}
