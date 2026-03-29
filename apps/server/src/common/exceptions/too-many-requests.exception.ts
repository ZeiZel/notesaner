import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 429 Too Many Requests exception.
 *
 * NestJS does not provide a built-in TooManyRequestsException
 * in all versions, so we define our own.
 */
export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
