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
  UnauthorizedException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, OrdersQueryDto } from './dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@/core/guards/auth.guard';

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
   * Get authenticated user's orders
   * GET /api/orders/my-orders
   * Only uses userId - not email - because users may use different emails for checkout
   */
  @Get('my-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get authenticated user's orders" })
  async getMyOrders(@Request() req: any) {
    const userId = req.user?.id;
    console.log('userId', userId);
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    this.logger.log(`Get orders for authenticated user: ${userId}`);
    // Only use userId - orders are tied to the authenticated user, not checkout email
    return this.orderService.getUserOrdersByUserId(userId);
  }

  /**
   * Get user's orders by email (legacy endpoint - kept for backward compatibility)
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
   * Requires authentication - userId will be attached from authenticated session
   */
  @Post('create')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: any,
  ) {
    try {
      // Get userId from authenticated session
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      this.logger.log(`Create order request from authenticated user: ${userId} (${createOrderDto.buyerEmail})`);
      this.logger.debug('Order data:', JSON.stringify(createOrderDto, null, 2));

      // Create order with authenticated userId
      const result = await this.orderService.createOrder(userId, createOrderDto);
      
      return {
        success: true,
        message: 'Order created successfully',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Order creation failed:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to create order',
        error: error.response?.message || error.message,
      };
    }
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
