import { Module } from "@nestjs/common";
import { ArtworkService } from "./artwork.service";
import { ArtworkController } from "./artwork.controller";
import { ArtworkEventSubscriber } from "./artwork-event.subscriber";
import { PrismaModule } from "../../core/database";
import { UploadModule } from "../../libraries/upload";
import { S3Module } from "../../libraries/s3";
import { EmailModule } from "../../libraries/email";
import { GuardsModule } from "../../core/guards/guards.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    S3Module,
    EmailModule,
    GuardsModule,
    SettingsModule,
  ],
  controllers: [ArtworkController],
  providers: [ArtworkService, ArtworkEventSubscriber],
  exports: [ArtworkService],
})
export class ArtworkModule {}
