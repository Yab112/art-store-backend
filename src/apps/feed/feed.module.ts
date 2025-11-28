import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PrismaModule } from '../../core/database';
import { FollowModule } from '../follow/follow.module';

@Module({
  imports: [PrismaModule, FollowModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}

