import {
  IsString,
  IsNumber,
  IsEmail,
  IsOptional,
  IsEnum,
} from "class-validator";

export enum PaymentProvider {
  CHAPA = "chapa",
  PAYPAL = "paypal",
}

export enum Currency {
  ETB = "ETB",
  USD = "USD",
}

export class InitializePaymentDto {
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @IsNumber()
  amount: number;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsString()
  @IsOptional()
  callbackUrl?: string;

  @IsString()
  txRef: string;
}
