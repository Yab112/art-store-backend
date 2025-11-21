import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsNotEmpty()
  @IsString()
  accountHolder: string;

  @IsNotEmpty()
  @IsString()
  iban: string;

  @IsOptional()
  @IsString()
  bicCode?: string;
}
