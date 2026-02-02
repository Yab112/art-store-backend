import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { OrderSchedulerService } from "./order-scheduler.service";
import { PrismaModule } from "../../core/database/prisma.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [OrderController],
  providers: [OrderService, OrderSchedulerService],
  exports: [OrderService],
})
export class OrderModule {}
