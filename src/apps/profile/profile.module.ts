import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileEventSubscriber } from './profile-event.subscriber';
import { PrismaModule } from '../../core/database';
import { EmailModule } from '../../libraries/email';
import { UploadModule } from '../../libraries/upload';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FollowModule } from '../follow/follow.module';

@Module({
  imports: [PrismaModule, EmailModule, UploadModule, AnalyticsModule, FollowModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileEventSubscriber],
  exports: [ProfileService],
})
export class ProfileModule {}
