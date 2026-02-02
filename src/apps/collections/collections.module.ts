import { Module } from "@nestjs/common";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { CollectionsEventSubscriber } from "./collections-event.subscriber";
import { PrismaModule } from "../../core/database";
import { EmailModule } from "../../libraries/email";
import { UploadModule } from "../../libraries/upload";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [PrismaModule, EmailModule, UploadModule, SettingsModule],
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsEventSubscriber],
  exports: [CollectionsService],
})
export class CollectionsModule {}
