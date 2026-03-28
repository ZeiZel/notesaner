import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FuzzyQueryDto {
  @ApiProperty({
    description: 'Search query string (typo-tolerant)',
    example: 'meting notes',
    minLength: 2,
    maxLength: 500,
  })
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(500, { message: 'q must not exceed 500 characters' })
  q!: string;

  @ApiPropertyOptional({
    description: 'Trigram similarity threshold (0-1). Default: 0.3',
    example: 0.3,
    default: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Max results (1-100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  limit?: number;
}
