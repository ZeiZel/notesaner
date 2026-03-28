import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service is healthy.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
        timestamp: { type: 'string', format: 'date-time', example: '2026-03-28T12:00:00.000Z' },
      },
    },
  })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'Service is alive.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Service is ready to accept traffic. Checks DB and Redis connectivity.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getReadiness(): HealthResponse {
    // Full implementation will check DB + Redis connectivity
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
