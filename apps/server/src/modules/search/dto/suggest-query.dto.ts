import { IsString, MaxLength, MinLength } from 'class-validator';

export class SuggestQueryDto {
  /**
   * Prefix string to autocomplete against note titles and headings.
   */
  @IsString()
  @MinLength(2, { message: 'prefix must be at least 2 characters' })
  @MaxLength(200, { message: 'prefix must not exceed 200 characters' })
  prefix!: string;
}
