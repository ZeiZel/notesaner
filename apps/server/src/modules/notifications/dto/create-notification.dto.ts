import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title', example: 'You were mentioned in a comment' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'Alice mentioned you in "Project Notes"',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({
    description: 'Contextual metadata (noteId, workspaceId, etc.)',
    example: { noteId: '123', workspaceId: '456' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
