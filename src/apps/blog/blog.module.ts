import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { BlogEventSubscriber } from './blog-event.subscriber';
import { BlogCommentsService } from './blog-comments.service';
import { BlogVotesService } from './blog-votes.service';
import { BlogSharesService } from './blog-shares.service';
import { PrismaModule } from '../../core/database';
import { EmailModule } from '../../libraries/email';
import { GuardsModule } from '../../core/guards/guards.module';
import { ConfigurationModule } from '../../core/configuration';

@Module({
  imports: [PrismaModule, EmailModule, GuardsModule, ConfigurationModule],
  controllers: [BlogController],
  providers: [
    BlogService,
    BlogEventSubscriber,
    BlogCommentsService,
    BlogVotesService,
    BlogSharesService,
  ],
  exports: [BlogService, BlogCommentsService, BlogVotesService, BlogSharesService],
})
export class BlogModule {}

