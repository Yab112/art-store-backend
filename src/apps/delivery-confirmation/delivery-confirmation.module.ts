import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { S3Module } from '../../libraries/s3';
import { BalanceModule } from '../balance/balance.module';
import { DeliveryConfirmationController } from './delivery-confirmation.controller';
import { DeliveryConfirmationService } from './delivery-confirmation.service';

@Module({
  imports: [PrismaModule, S3Module, BalanceModule],
  controllers: [DeliveryConfirmationController],
  providers: [DeliveryConfirmationService],
  exports: [DeliveryConfirmationService],
})
export class DeliveryConfirmationModule {}
