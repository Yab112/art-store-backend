import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrderSettingsDto {
  @ApiPropertyOptional({
    description: 'Order expiration time in hours (0 = no expiration)',
    example: 24,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderExpirationHours?: number;

  @ApiPropertyOptional({
    description: 'Auto-cancel pending orders after X days (0 = disabled)',
    example: 7,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  autoCancelPendingOrdersDays?: number;
}

