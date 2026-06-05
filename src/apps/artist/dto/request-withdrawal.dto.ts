import { IsNotEmpty, IsNumber, IsString, Min, IsOptional } from "class-validator";

export class RequestWithdrawalDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(10, { message: "Minimum withdrawal amount is $10" })
  amount: number;

  @IsNotEmpty()
  @IsString()
  iban: string;

  @IsString()
  @IsOptional()
  bankCode?: string;

  @IsString()
  @IsOptional()
  accountName?: string;
}
