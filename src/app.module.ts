import { Module } from '@nestjs/common';
import { CorsModule } from './core/cors';
import { ExceptionModule } from './core/exception';
import { LoggingModule } from './core/logging';
import { PrismaModule } from './core/database';
import { EmailModule } from './libraries/email';
import { EventModule } from './libraries/event';
import { LoggerModule } from './libraries/logger';
import { AppInfrastructureModule } from './app.infrastructure.module';
import { ConfigurationModule } from './core/configuration';
import { CookieModule } from './core/cookie';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Core infrastructure modules
    CorsModule,
    LoggerModule,
    ExceptionModule,
    CookieModule,
    LoggingModule,
    PrismaModule,
    EmailModule,
    ConfigurationModule,
    EventModule,
    AppInfrastructureModule,
  ],
  controllers: [HealthController],
  providers: [
    ...ExceptionModule.getFilters(),
    ...LoggingModule.getInterceptors(),
  ],
})
export class AppModule {}
