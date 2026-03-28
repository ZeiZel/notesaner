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

/**
 * Webhook event types that can be subscribed to.
 */
export enum WebhookEvent {
  NOTE_CREATED = 'note.created',
  NOTE_UPDATED = 'note.updated',
  NOTE_DELETED = 'note.deleted',
  NOTE_PUBLISHED = 'note.published',
}

export class CreateWebhookDto {
  @IsUrl({}, { message: 'url must be a valid URL' })
  @MaxLength(2048, { message: 'url must not exceed 2048 characters' })
  url!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'events must contain at least one event type' })
  @IsEnum(WebhookEvent, { each: true, message: 'each event must be a valid WebhookEvent' })
  events!: WebhookEvent[];

  /**
   * Optional shared secret for HMAC-SHA256 signing.
   * If omitted, a random secret is generated.
   */
  @IsOptional()
  @IsString()
  @MinLength(16, { message: 'secret must be at least 16 characters' })
  @MaxLength(256, { message: 'secret must not exceed 256 characters' })
  secret?: string;
}
