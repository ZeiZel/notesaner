import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUrl,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from './create-webhook.dto';

/**
 * DTO for PATCH /workspaces/:wid/webhooks/:id
 *
 * All fields are optional. At least one field must be present (validated
 * at the service layer — if nothing changes, the record is still updated
 * with a new updatedAt timestamp).
 */
export class UpdateWebhookDto {
  @ApiPropertyOptional({
    description: 'New destination URL for the webhook',
    example: 'https://hooks.newapp.com/notesaner',
    maxLength: 2048,
  })
  @IsOptional()
  @IsUrl({}, { message: 'url must be a valid URL' })
  @MaxLength(2048, { message: 'url must not exceed 2048 characters' })
  url?: string;

  @ApiPropertyOptional({
    description: 'Replacement list of event types to subscribe to (at least one)',
    type: [String],
    enum: WebhookEvent,
    example: ['note.created', 'note.updated'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'events must contain at least one event type' })
  @IsEnum(WebhookEvent, { each: true, message: 'each event must be a valid WebhookEvent' })
  events?: WebhookEvent[];

  @ApiPropertyOptional({
    description: 'Set to false to pause delivery without deleting the subscription',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
