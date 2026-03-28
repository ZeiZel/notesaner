import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO for directly triggering an email send (dev/test endpoint).
 */
export class SendEmailDto {
  /**
   * Recipient email address.
   */
  @IsEmail({}, { message: 'to must be a valid email address' })
  to!: string;

  /**
   * Template identifier (e.g. "verification", "password-reset").
   */
  @IsString()
  template!: string;

  /**
   * Variables to interpolate into the template.
   */
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
