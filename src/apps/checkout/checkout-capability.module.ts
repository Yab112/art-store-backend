import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/database/prisma.module";
import { BalanceModule } from "../balance/balance.module";
import { CurrencyModule } from "../../libraries/currency/currency.module";
import { CheckoutCapabilityService } from "./checkout-capability.service";
import { CheckoutCapabilityController } from "./checkout-capability.controller";
import { CheckoutPricingService } from "./checkout-pricing.service";

@Module({
  imports: [PrismaModule, BalanceModule, CurrencyModule],
  controllers: [CheckoutCapabilityController],
  providers: [CheckoutCapabilityService, CheckoutPricingService],
  exports: [CheckoutCapabilityService, CheckoutPricingService],
})
export class CheckoutCapabilityModule {}
