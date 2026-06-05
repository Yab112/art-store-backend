import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({
    description: "Minimum withdrawal amount (PayPal/USD)",
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWithdrawalAmountPaypal?: number;

  @ApiPropertyOptional({
    description: "Minimum withdrawal amount (Chapa/ETB)",
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWithdrawalAmountChapa?: number;

  @ApiPropertyOptional({
    description: "Maximum withdrawal amount (PayPal/USD, 0 = unlimited)",
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWithdrawalAmountPaypal?: number;

  @ApiPropertyOptional({
    description: "Maximum withdrawal amount (Chapa/ETB, 0 = unlimited)",
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWithdrawalAmountChapa?: number;

  @ApiPropertyOptional({
    description: "Legacy maximum withdrawal amount",
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
