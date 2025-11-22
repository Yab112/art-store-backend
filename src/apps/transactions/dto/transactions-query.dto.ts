import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

/**
 * Query DTO for filtering and paginating transactions
 */
export class TransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search by buyer email or transaction ID',
    example: 'user@example.com'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment provider (chapa, paypal, etc.)',
    example: 'chapa'
  })
  @IsOptional()
  @IsString()
  provider?: string;
}

