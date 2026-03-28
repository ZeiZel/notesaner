import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, NotificationChannel, DigestFrequency } from '@prisma/client';

export class NotificationPreferenceItemDto {
  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ description: 'Delivery channel', enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: 'Array of notification type preferences',
    type: [NotificationPreferenceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}

export class UpdateDigestScheduleDto {
  @ApiProperty({ description: 'Digest email frequency', enum: DigestFrequency })
  @IsEnum(DigestFrequency)
  frequency!: DigestFrequency;
}

export class GetPreferencesResponseDto {
  @ApiProperty({
    description: 'Per-type notification channel preferences',
    type: [NotificationPreferenceItemDto],
  })
  preferences!: NotificationPreferenceItemDto[];

  @ApiProperty({ description: 'Digest email frequency', enum: DigestFrequency })
  frequency!: DigestFrequency;

  @ApiPropertyOptional({ description: 'Last digest sent timestamp' })
  lastSentAt!: string | null;
}
