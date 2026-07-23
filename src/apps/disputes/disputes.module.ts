import { Module } from "@nestjs/common";
import { DisputesController } from "./disputes.controller";
import { SellerDisputesController } from "./seller-disputes.controller";
import { DisputesService } from "./disputes.service";
import { PrismaModule } from "../../core/database";
import { BalanceModule } from "../balance/balance.module";
import { PaymentModule } from "../payment/payment.module";
import { S3Module } from "../../libraries/s3";
import { EmailModule } from "../../libraries/email";

@Module({
  imports: [PrismaModule, BalanceModule, PaymentModule, S3Module, EmailModule],
  controllers: [DisputesController, SellerDisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
