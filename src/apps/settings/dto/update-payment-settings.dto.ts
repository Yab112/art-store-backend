import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({
    description: "Minimum withdrawal amount",
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWithdrawalAmount?: number;

  @ApiPropertyOptional({
    description: "Maximum withdrawal amount (0 = unlimited)",
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWithdrawalAmount?: number;

  @ApiPropertyOptional({
    description: "Payment timeout in minutes",
    example: 30,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  paymentTimeoutMinutes?: number;
}
