import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for directly triggering an email send (dev/test endpoint).
 */
export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'alice@example.com',
  })
  @IsEmail({}, { message: 'to must be a valid email address' })
  to!: string;

  @ApiProperty({
    description: 'Template identifier',
    example: 'verification',
    enum: [
      'verification',
      'password-reset',
      'workspace-invite',
      'comment-mention',
      'freshness-alert',
    ],
  })
  @IsString()
  template!: string;

  @ApiPropertyOptional({
    description: 'Variables to interpolate into the template',
    example: { displayName: 'Alice', verificationUrl: 'https://app.notesaner.io/verify?token=abc' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
