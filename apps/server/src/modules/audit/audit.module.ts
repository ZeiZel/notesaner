import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { ValkeyModule } from '../valkey/valkey.module';

/**
 * AuditModule — enterprise audit-log subsystem.
 *
 * Provides:
 *   - AuditService  — write, query, export, purge, GDPR
 *   - AuditController — REST API under /workspaces/:id/audit-log
 *   - AuditInterceptor — auto-logging decorator integration
 *
 * Imports ValkeyModule to access the Valkey sorted-set storage.
 * PrismaModule is globally provided so no explicit import needed.
 *
 * AuditService is exported so other modules can inject it for programmatic
 * logging without importing the full AuditModule.
 */
@Module({
  imports: [ValkeyModule],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
