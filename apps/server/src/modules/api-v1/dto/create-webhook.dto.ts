import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Webhook event types that can be subscribed to.
 */
export enum WebhookEvent {
  NOTE_CREATED = 'note.created',
  NOTE_UPDATED = 'note.updated',
  NOTE_DELETED = 'note.deleted',
  NOTE_PUBLISHED = 'note.published',
  MEMBER_JOINED = 'member.joined',
  MEMBER_LEFT = 'member.left',
}

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook destination URL',
    example: 'https://hooks.myapp.com/notesaner',
    maxLength: 2048,
  })
  @IsUrl({}, { message: 'url must be a valid URL' })
  @MaxLength(2048, { message: 'url must not exceed 2048 characters' })
  url!: string;

  @ApiProperty({
    description: 'Event types to subscribe to (at least one)',
    type: [String],
    enum: WebhookEvent,
    example: ['note.created', 'note.updated'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'events must contain at least one event type' })
  @IsEnum(WebhookEvent, { each: true, message: 'each event must be a valid WebhookEvent' })
  events!: WebhookEvent[];

  @ApiPropertyOptional({
    description: 'Shared secret for HMAC-SHA256 signing. Auto-generated if omitted.',
    minLength: 16,
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @MinLength(16, { message: 'secret must be at least 16 characters' })
  @MaxLength(256, { message: 'secret must not exceed 256 characters' })
  secret?: string;
}
