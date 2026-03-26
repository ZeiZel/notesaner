import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string;
  code: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    const errorResponse = this.buildErrorResponse(exception, request.url);

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.url}: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, path: string): ErrorResponse {
    const timestamp = new Date().toISOString();

    // NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message
            ? Array.isArray((res as { message: string[] }).message)
              ? (res as { message: string[] }).message.join('; ')
              : ((res as { message: string }).message ?? exception.message)
            : exception.message;

      return {
        statusCode: status,
        message,
        code: this.getHttpExceptionCode(status),
        timestamp,
        path,
      };
    }

    // Prisma known errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaKnownError(exception, path, timestamp);
    }

    // Prisma validation errors
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        code: 'VALIDATION_ERROR',
        timestamp,
        path,
      };
    }

    // Unexpected errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp,
      path,
    };
  }

  private handlePrismaKnownError(
    error: Prisma.PrismaClientKnownRequestError,
    path: string,
    timestamp: string,
  ): ErrorResponse {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with these values already exists',
          code: 'CONFLICT',
          timestamp,
          path,
        };
      case 'P2025': // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          code: 'NOT_FOUND',
          timestamp,
          path,
        };
      case 'P2003': // Foreign key constraint failure
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found',
          code: 'FOREIGN_KEY_CONSTRAINT',
          timestamp,
          path,
        };
      default:
        this.logger.error(`Unhandled Prisma error ${error.code}`, error.message);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          code: 'DATABASE_ERROR',
          timestamp,
          path,
        };
    }
  }

  private getHttpExceptionCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] ?? `HTTP_${status}`;
  }
}
