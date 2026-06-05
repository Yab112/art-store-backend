import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentProvider } from "../../payment/dto/initialize-payment.dto";

export class UpdatePaymentMethodPreferenceDto {
  @IsEnum(PaymentProvider)
  paymentMethodPreference: PaymentProvider;

  @IsOptional()
  @IsString()
  paypalEmail?: string;

  @IsOptional()
  @IsString()
  chapaAccountName?: string;

  @IsOptional()
  @IsString()
  chapaAccountNumber?: string;

  @IsOptional()
  @IsString()
  chapaBankCode?: string;
}
