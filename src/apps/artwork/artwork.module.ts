import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { ArtworkEventSubscriber } from './artwork-event.subscriber';
import { PrismaModule } from '../../core/database';
import { UploadModule } from '../../libraries/upload';
import { EmailModule } from '../../libraries/email';
import { GuardsModule } from '../../core/guards/guards.module';

@Module({
  imports: [PrismaModule, UploadModule, EmailModule, GuardsModule],
  controllers: [ArtworkController],
  providers: [ArtworkService, ArtworkEventSubscriber],
  exports: [ArtworkService],
})
export class ArtworkModule {}
