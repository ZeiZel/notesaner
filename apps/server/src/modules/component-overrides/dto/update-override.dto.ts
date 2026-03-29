import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOverrideDto {
  @ApiPropertyOptional({
    description: 'Updated TSX source code.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  sourceCode?: string;
}
