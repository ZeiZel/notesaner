import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

/**
 * EmailModule — provides transactional email infrastructure.
 *
 * Exports EmailService so other modules can inject it directly without
 * importing the full module. The dev-only EmailController is registered
 * here but guards itself against non-development environments.
 *
 * @example
 * // In any NestJS module that needs to send emails:
 * @Module({
 *   imports: [EmailModule],
 * })
 * export class AuthModule {}
 *
 * // Then inject EmailService:
 * constructor(private readonly emailService: EmailService) {}
 */
@Module({
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
