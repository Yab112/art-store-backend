import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { PrismaModule } from '../../core/database';
import { GuardsModule } from '../../core/guards/guards.module';

@Module({
  imports: [PrismaModule, GuardsModule],
  controllers: [TestController],
})
export class TestModule {}

