import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Platform commission rate (0-100)',
    example: 10,
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  platformCommissionRate?: number;

  @ApiPropertyOptional({
    description: 'Site name',
    example: 'Art Gallery'
  })
  @IsOptional()
  @IsString()
  siteName?: string;
}

