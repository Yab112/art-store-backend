import { Module } from '@nestjs/common';
import { ArtistController } from './artist.controller';
import { ArtistService } from './artist.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ArtworkModule } from '../artwork/artwork.module';

@Module({
  imports: [PrismaModule, SettingsModule, ArtworkModule],
  controllers: [ArtistController],
  providers: [ArtistService],
  exports: [ArtistService],
})
export class ArtistModule {} 