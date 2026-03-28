import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * A single preference entry within a bulk update request.
 */
export class BulkPreferenceEntry {
  @ApiProperty({
    description: 'Preference key (1-128 chars, alphanumeric with dots/hyphens/underscores)',
    example: 'theme',
  })
  @IsString()
  @MaxLength(128, { message: 'key must not exceed 128 characters' })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message:
      'key must start with an alphanumeric character and contain only alphanumeric characters, dots, hyphens, or underscores',
  })
  key!: string;

  @ApiProperty({
    description: 'Preference value — any valid JSON value',
    example: 'dark',
  })
  @IsNotEmpty({ message: 'value must not be empty' })
  value: unknown;
}

/**
 * DTO for bulk-updating multiple user preferences at once.
 */
export class BulkSetPreferencesDto {
  @ApiProperty({
    description: 'Array of preference key-value pairs to set (1-100 entries)',
    type: [BulkPreferenceEntry],
    example: [
      { key: 'theme', value: 'dark' },
      { key: 'editor.fontSize', value: 16 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'preferences must contain at least 1 entry' })
  @ArrayMaxSize(100, { message: 'preferences must not exceed 100 entries' })
  @ValidateNested({ each: true })
  @Type(() => BulkPreferenceEntry)
  preferences!: BulkPreferenceEntry[];
}
