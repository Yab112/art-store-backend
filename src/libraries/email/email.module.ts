import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailBridgeInitializerService } from './email-bridge-initializer.service';
import { LoggerModule } from '../logger';
import { ConfigurationModule } from '../../core/configuration';

@Module({
  imports: [LoggerModule, ConfigurationModule],
  providers: [EmailService, EmailBridgeInitializerService],
  exports: [EmailService],
})
export class EmailModule {}
