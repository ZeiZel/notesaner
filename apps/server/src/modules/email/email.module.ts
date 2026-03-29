import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailTemplatesService } from './templates/email-templates.service';

/**
 * EmailModule — provides transactional email infrastructure.
 *
 * Exports EmailService and EmailTemplatesService so other modules can inject
 * them directly without importing the full module. The dev-only EmailController
 * is registered here but guards itself against non-development environments.
 *
 * @example
 * // In any NestJS module that needs to send emails:
 * @Module({
 *   imports: [EmailModule],
 * })
 * export class AuthModule {}
 *
 * // Then inject EmailService or EmailTemplatesService:
 * constructor(
 *   private readonly emailService: EmailService,
 *   private readonly emailTemplates: EmailTemplatesService,
 * ) {}
 */
@Module({
  controllers: [EmailController],
  providers: [EmailService, EmailTemplatesService],
  exports: [EmailService, EmailTemplatesService],
})
export class EmailModule {}
