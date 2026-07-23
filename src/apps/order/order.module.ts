import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { CheckoutPrepareController } from "./checkout-prepare.controller";
import { OrderService } from "./order.service";
import { OrderSchedulerService } from "./order-scheduler.service";
import { PrismaModule } from "../../core/database/prisma.module";
import { SettingsModule } from "../settings/settings.module";
import { FedExModule } from "../fedex/fedex.module";
import { BalanceModule } from "../balance/balance.module";
import { CheckoutCapabilityModule } from "../checkout/checkout-capability.module";

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    FedExModule,
    BalanceModule,
    CheckoutCapabilityModule,
  ],
  controllers: [OrderController, CheckoutPrepareController],
  providers: [OrderService, OrderSchedulerService],
  exports: [OrderService],
})
export class OrderModule {}
