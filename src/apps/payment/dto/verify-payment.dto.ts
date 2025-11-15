import { IsString, IsEnum } from 'class-validator';
import { PaymentProvider } from './initialize-payment.dto';

export class VerifyPaymentDto {
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @IsString()
  txRef: string;
}
