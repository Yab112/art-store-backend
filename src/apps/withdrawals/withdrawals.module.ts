import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaModule } from '../../core/database';
import { ArtistModule } from '../artist/artist.module';

@Module({
  imports: [PrismaModule, ArtistModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}

