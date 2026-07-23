import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { AuthGuard } from '../../core/guards/auth.guard';
import { DeliveryConfirmationService } from './delivery-confirmation.service';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';

@Controller('delivery-confirmation')
export class DeliveryConfirmationController {
  constructor(private readonly deliveryConfirmationService: DeliveryConfirmationService) {}

  @UseGuards(AuthGuard)
  @Post()
  async confirmDelivery(@Request() req, @Body() confirmDto: ConfirmDeliveryDto) {
    return this.deliveryConfirmationService.confirmDelivery(req.user.id, confirmDto);
  }

  @UseGuards(AuthGuard)
  @Get(':orderId')
  async getConfirmation(@Request() req, @Param('orderId') orderId: string) {
    return this.deliveryConfirmationService.getConfirmation(req.user.id, orderId);
  }
}
