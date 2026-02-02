import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { ProfileEventSubscriber } from "./profile-event.subscriber";
import { PrismaModule } from "../../core/database";
import { EmailModule } from "../../libraries/email";
import { UploadModule } from "../../libraries/upload";

@Module({
  imports: [PrismaModule, EmailModule, UploadModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileEventSubscriber],
  exports: [ProfileService],
})
export class ProfileModule {}
