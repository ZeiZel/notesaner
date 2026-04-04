import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MigrationHealthIndicator } from '../../common/database';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly migrationHealth: MigrationHealthIndicator,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiOkResponse({
    description: 'Health status for all services.',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['start', 'pending', 'alive', 'error'],
          example: 'alive',
        },
        timestamp: { type: 'string', format: 'date-time' },
        services: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['start', 'pending', 'alive', 'error'] },
                latency_ms: { type: 'number' },
              },
            },
            valkey: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['start', 'pending', 'alive', 'error'] },
                latency_ms: { type: 'number' },
              },
            },
            migrations: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['start', 'pending', 'alive', 'error'] },
                schemaVersion: { type: 'string', nullable: true },
                appliedCount: { type: 'number' },
                pendingMigrations: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'One or more services are unhealthy (production only).' })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.getComprehensiveHealth();

    if (process.env['NODE_ENV'] === 'production' && result.status === 'error') {
      res.status(503);
    }

    return result;
  }

  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'Service process is alive.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'], example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Service is ready to accept traffic. Checks migration state and DB connectivity.',
  })
  getReadiness() {
    return this.health.check([() => this.migrationHealth.isHealthy()]);
  }
}
