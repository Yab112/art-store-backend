import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdatePaymentGatewayDto {
  @ApiPropertyOptional({
    description: 'Enable or disable the payment gateway',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Gateway configuration (JSON)',
    example: { apiKey: 'xxx', secret: 'xxx' }
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

