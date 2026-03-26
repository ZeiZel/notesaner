import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  getReadiness(): HealthResponse {
    // Full implementation will check DB + Redis connectivity
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
