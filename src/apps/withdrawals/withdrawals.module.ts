import { Module, forwardRef } from "@nestjs/common";
import { WithdrawalsController } from "./withdrawals.controller";
import { WithdrawalsService } from "./withdrawals.service";
import { PrismaModule } from "../../core/database";
import { ArtistModule } from "../artist/artist.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [
    PrismaModule,
    ArtistModule,
    forwardRef(() => PaymentModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
