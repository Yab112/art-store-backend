import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ChapaService } from './chapa.service';
import { PaypalService } from './paypal.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentController],
  providers: [PaymentService, ChapaService, PaypalService],
  exports: [PaymentService, ChapaService, PaypalService],
})
export class PaymentModule {}
