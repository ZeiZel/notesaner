import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validateConfig } from './config/validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { NotesModule } from './modules/notes/notes.module';
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';
import { SyncModule } from './modules/sync/sync.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { PublishModule } from './modules/publish/publish.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateConfig,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    NotesModule,
    FilesModule,
    SearchModule,
    SyncModule,
    PluginsModule,
    PublishModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
