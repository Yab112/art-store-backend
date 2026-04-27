import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { ChapaService } from "./chapa.service";
import { PaypalService } from "./paypal.service";
import { PrismaModule } from "../../core/database/prisma.module";
import { OrderModule } from "../order/order.module";
import { CartModule } from "../cart/cart.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    OrderModule,
    CartModule,
    forwardRef(() => WithdrawalsModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [PaymentController],
  providers: [PaymentService, ChapaService, PaypalService],
  exports: [PaymentService, ChapaService, PaypalService],
})
export class PaymentModule {}
