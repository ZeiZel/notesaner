import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { GitHubReleaseService } from './github-release.service';
import { HotReloadService } from './hot-reload.service';
import { PluginWatcherGateway } from './plugin-watcher.gateway';
import { PluginSandboxManagerService } from './plugin-sandbox-manager.service';

/**
 * PluginsModule — Plugin lifecycle management.
 *
 * Core providers (always registered):
 *   - PluginsController — REST API for plugin install/uninstall/settings
 *   - PluginsService — Plugin business logic
 *
 * Development-only providers (NODE_ENV=development):
 *   - HotReloadService — Watches plugin directories for file changes (chokidar)
 *   - PluginSandboxManagerService — Manages plugin sandbox lifecycle (destroy/recreate)
 *   - PluginWatcherGateway — WebSocket gateway broadcasting PLUGIN_RELOADED events
 *
 * The development providers are registered conditionally via `forRoot()` to avoid
 * unnecessary filesystem watchers and WebSocket endpoints in production.
 */
@Module({})
export class PluginsModule {
  static forRoot(): DynamicModule {
    const isDevelopment = process.env['NODE_ENV'] === 'development' || !process.env['NODE_ENV'];

    const coreProviders: Provider[] = [PluginsService, GitHubReleaseService];

    const devProviders: Provider[] = isDevelopment
      ? [HotReloadService, PluginSandboxManagerService, PluginWatcherGateway]
      : [];

    return {
      module: PluginsModule,
      imports: [ConfigModule],
      controllers: [PluginsController],
      providers: [...coreProviders, ...devProviders],
      exports: [PluginsService, GitHubReleaseService],
    };
  }
}
