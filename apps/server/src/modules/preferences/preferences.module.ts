import { Module } from '@nestjs/common';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/**
 * PreferencesModule — user preferences (settings) storage and sync.
 *
 * Provides:
 *   - PreferencesService — CRUD for per-user key-value preferences
 *   - PreferencesController — REST API under /api/preferences
 *
 * Dependencies (globally provided, no explicit import needed):
 *   - PrismaModule — database access
 *   - ValkeyModule — cache layer for preference reads
 *
 * PreferencesService is exported so other modules can read/write
 * preferences programmatically (e.g. theme service, plugin defaults).
 */
@Module({
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
