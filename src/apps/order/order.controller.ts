import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, OrdersQueryDto } from './dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  /**
   * Get all orders with pagination and filters
   * GET /api/orders
   */
  @Get()
  @ApiOperation({ summary: 'Get all orders with pagination and filters' })
  async findAll(@Query() query: OrdersQueryDto) {
    return this.orderService.findAll(
      query.page || 1,
      query.limit || 20,
      query.search,
      query.status,
    );
  }

  /**
   * Get user's orders
   * GET /api/orders/user/:email
   */
  @Get('user/:email')
  @ApiOperation({ summary: "Get orders for a specific user by email" })
  async getUserOrders(@Param('email') email: string) {
    this.logger.log(`Get orders for user: ${email}`);
    return this.orderService.getUserOrders(email);
  }

  /**
   * Create a new order
   * POST /api/orders/create
   */
  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: any,
  ) {
    this.logger.log(`Create order request from: ${createOrderDto.buyerEmail}`);

    // Get userId from authenticated session or by email
    let userId = req.user?.id;

    // If no user in session, try to get user by email
    if (!userId) {
      const user = await this.orderService.getUserByEmail(
        createOrderDto.buyerEmail,
      );
      userId = user?.id || 'guest';
    }

    return this.orderService.createOrder(userId, createOrderDto);
  }

  /**
   * Complete order (called after payment verification)
   * POST /api/orders/:id/complete
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an order after payment verification' })
  async completeOrder(
    @Param('id') id: string,
    @Body() body: { txRef: string; paymentProvider: string },
  ) {
    this.logger.log(`Complete order: ${id}`);
    return this.orderService.completeOrder(
      id,
      body.txRef,
      body.paymentProvider,
    );
  }

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get an order by ID' })
  async getOrder(@Param('id') id: string) {
    this.logger.log(`Get order: ${id}`);
    return this.orderService.getOrderById(id);
  }
}
