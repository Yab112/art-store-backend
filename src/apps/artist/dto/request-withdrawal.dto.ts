import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class RequestWithdrawalDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(10, { message: 'Minimum withdrawal amount is $10' })
  amount: number;

  @IsNotEmpty()
  @IsString()
  iban: string;
}
