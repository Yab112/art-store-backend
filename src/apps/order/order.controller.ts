import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  /**
   * Create a new order
   * POST /api/orders/create
   */
  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createOrder(@Body() createOrderDto: CreateOrderDto, @Request() req: any) {
    this.logger.log(`Create order request from: ${createOrderDto.buyerEmail}`);

    // In a real app, get userId from authenticated session
    // For now, we'll use a placeholder
    const userId = req.user?.id || 'guest';

    return this.orderService.createOrder(userId, createOrderDto);
  }

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    this.logger.log(`Get order: ${id}`);
    return this.orderService.getOrderById(id);
  }

  /**
   * Get user's orders
   * GET /api/orders/user/:email
   */
  @Get('user/:email')
  async getUserOrders(@Param('email') email: string) {
    this.logger.log(`Get orders for user: ${email}`);
    return this.orderService.getUserOrders(email);
  }

  /**
   * Complete order (called after payment verification)
   * POST /api/orders/:id/complete
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeOrder(
    @Param('id') id: string,
    @Body() body: { txRef: string; paymentProvider: string },
  ) {
    this.logger.log(`Complete order: ${id}`);
    return this.orderService.completeOrder(id, body.txRef, body.paymentProvider);
  }
}
