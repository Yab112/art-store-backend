import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString, Min, IsOptional } from "class-validator";

export class CreateWithdrawalDto {
  @ApiProperty({
    description: "Amount to withdraw",
    example: 100.0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: "Minimum withdrawal amount is $1.00" })
  amount: number;

  @ApiProperty({
    description: "Payout account (e.g., PayPal email or IBAN)",
    example: "artist@example.com",
  })
  @IsNotEmpty()
  @IsString()
  payoutAccount: string;

  @ApiProperty({
    description: "Bank Code for Chapa local bank transfers",
    example: "80a510ea-7497-4499-8b49-ac13a3ab7d07",
    required: false,
  })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiProperty({
    description: "Account Name for Chapa local bank transfers",
    example: "John Doe",
    required: false,
  })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiProperty({
    description: "Payout method (PAYPAL or CHAPA)",
    example: "CHAPA",
  })
  @IsNotEmpty()
  @IsString()
  method: string;

  @ApiProperty({
    description: "Currency (USD or ETB)",
    example: "ETB",
  })
  @IsNotEmpty()
  @IsString()
  currency: string;
}
