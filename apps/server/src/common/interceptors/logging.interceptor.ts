import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.debug(`${method} ${url} — ${duration}ms`);
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`${method} ${url} — ${duration}ms — error: ${message}`);
        },
      }),
    );
  }
}
