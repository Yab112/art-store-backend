import { Module } from "@nestjs/common";
import { TalentTypeService } from "./talent-type.service";
import { TalentTypeController } from "./talent-type.controller";
import { PrismaModule } from "../../core/database";
import { S3Module } from "../../libraries/s3";

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [TalentTypeController],
  providers: [TalentTypeService],
  exports: [TalentTypeService],
})
export class TalentTypeModule {}
