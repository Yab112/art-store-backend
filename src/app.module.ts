import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { UsersModule } from './apps/users/users.module';
import { ArtworkModule } from './apps/artwork/artwork.module';
import { CategoryModule } from './apps/category/category.module';
import { CollectionsModule } from './apps/collections/collections.module';
import { OrderModule } from './apps/order/order.module';
import { TransactionsModule } from './apps/transactions/transactions.module';
import { SettingsModule } from './apps/settings/settings.module';
import { WithdrawalsModule } from './apps/withdrawals/withdrawals.module';
import { FollowModule } from './apps/follow/follow.module';
import { FeedModule } from './apps/feed/feed.module';

@Module({
  imports: [
    // Core infrastructure modules
    ScheduleModule.forRoot(),
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
    // Application modules
    UsersModule,
    ArtworkModule,
    CategoryModule,
    CollectionsModule,
    OrderModule,
    TransactionsModule,
    SettingsModule,
    WithdrawalsModule,
    FollowModule,
    FeedModule,
  ],
  controllers: [],
  providers: [
    ...ExceptionModule.getFilters(),
    ...LoggingModule.getInterceptors(),
  ],
})
export class AppModule { }
