import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { PrismaModule } from '../database';

@Module({
  imports: [PrismaModule],
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class GuardsModule {}

