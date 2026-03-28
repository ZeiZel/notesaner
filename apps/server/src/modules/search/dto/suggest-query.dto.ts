import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuggestQueryDto {
  @ApiProperty({
    description: 'Prefix string to autocomplete against note titles',
    example: 'meet',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: 'prefix must be at least 2 characters' })
  @MaxLength(200, { message: 'prefix must not exceed 200 characters' })
  prefix!: string;
}
