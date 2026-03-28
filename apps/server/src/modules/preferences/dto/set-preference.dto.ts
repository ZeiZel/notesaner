import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for setting (upserting) a single user preference.
 * The key is taken from the URL parameter; the value from the body.
 */
export class SetPreferenceDto {
  @ApiProperty({
    description: 'Preference value — any valid JSON value (string, number, boolean, object, array)',
    example: { fontSize: 16, fontFamily: 'Inter' },
  })
  @IsNotEmpty({ message: 'value must not be empty' })
  value: unknown;
}

/**
 * Validates the preference key from the URL parameter.
 * Keys must be 1-128 characters, alphanumeric with dots and hyphens allowed.
 * Examples: "theme", "editor.fontSize", "sidebar.collapsed"
 */
export class PreferenceKeyParam {
  @ApiProperty({
    description: 'Preference key (1-128 chars, alphanumeric with dots/hyphens/underscores)',
    example: 'editor.fontSize',
  })
  @IsString()
  @MaxLength(128, { message: 'key must not exceed 128 characters' })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message:
      'key must start with an alphanumeric character and contain only alphanumeric characters, dots, hyphens, or underscores',
  })
  key!: string;
}
