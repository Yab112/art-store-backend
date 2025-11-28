import { IsEnum } from 'class-validator';
import { PaymentProvider } from '../../payment/dto/initialize-payment.dto';

export class UpdatePaymentMethodPreferenceDto {
  @IsEnum(PaymentProvider)
  paymentMethodPreference: PaymentProvider;
}

