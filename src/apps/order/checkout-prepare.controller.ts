import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../core/guards/auth.guard";
import { OrderService } from "./order.service";
import { PrepareCheckoutDto } from "./dto/prepare-checkout.dto";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutPrepareController {
  private readonly logger = new Logger(CheckoutPrepareController.name);

  constructor(private readonly orderService: OrderService) {}

  /**
   * Prepare multi-seller checkout: one PENDING order per seller.
   * POST /api/checkout/prepare
   */
  @Post("prepare")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Create one pending order per seller for multi-seller checkout",
  })
  async prepare(@Request() req: any, @Body() dto: PrepareCheckoutDto) {
    const userId = req.user?.id || req.user?.userId;
    this.logger.log(
      `Prepare checkout for user ${userId}: ${dto.groups?.length || 0} group(s)`,
    );
    return this.orderService.prepareCheckout(userId, dto);
  }
}
