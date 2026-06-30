import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class SatellitesQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Configured CelesTrak group. Defaults to active.',
    example: 'starlink',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i)
  group?: string;
}

export class SearchQueryDto {
  @ApiProperty({ type: String, example: 'iss', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
