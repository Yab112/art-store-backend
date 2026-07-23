import { Module } from '@nestjs/common';
import { FedExService } from './fedex.service';
import { FedExController } from './fedex.controller';
import { FedExTrackingScheduler } from './fedex-tracking.scheduler';
import { PrismaModule } from '../../core/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CartModule } from '../cart/cart.module';
import { S3Module } from '../../libraries/s3';

@Module({
  imports: [PrismaModule, ConfigModule, CartModule, S3Module],
  controllers: [FedExController],
  providers: [FedExService, FedExTrackingScheduler],
  exports: [FedExService],
})
export class FedExModule {}
