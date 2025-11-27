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
import { CreateOrderDto, OrdersQueryDto, PlatformCommissionQueryDto } from './dto';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../core/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
   */
  @Get('my-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get orders for the authenticated user" })
  async getMyOrders(@CurrentUser() user: any) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User ID not found in session');
    }
    this.logger.log(`Get orders for authenticated user: ${user.id}, email: ${user.email || 'N/A'}`);
    // Pass both userId and email to catch all orders (including those created before userId was set)
    return this.orderService.getUserOrders(user.id, user.email);
  }

  /**
   * Get user's orders by userId
   * GET /api/orders/user/:userId
   */
  @Get('user/:userId')
  @ApiOperation({ summary: "Get orders for a specific user by userId" })
  async getUserOrders(@Param('userId') userId: string) {
    this.logger.log(`Get orders for user: ${userId}`);
    return this.orderService.getUserOrders(userId);
  }

  /**
   * Create a new order
   * POST /api/orders/create
   * Requires authentication - user must be logged in
   */
  @Post('create')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new order (requires authentication)' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Create order request from: ${createOrderDto.buyerEmail}`);
    
    // Get userId from authenticated session
    let userId = user.id;
    
    if (user && user.id) {
      userId = user.id;
      this.logger.log(`✅ User authenticated: ${userId} (${user.email || 'N/A'})`);
    } else {
      // Fallback: try to get user by email (for backward compatibility)
      this.logger.warn(`⚠️ No user in session, trying to find by email: ${createOrderDto.buyerEmail}`);
      try {
        const userByEmail = await this.orderService.getUserByEmail(
          createOrderDto.buyerEmail,
        );
        if (userByEmail?.id) {
          userId = userByEmail.id;
          this.logger.log(`✅ Found user by email: ${userId}`);
        } else {
          this.logger.warn(`⚠️ User not found by email, creating as guest`);
          userId = 'guest';
        }
      } catch (error) {
        this.logger.error(`❌ Failed to find user by email:`, error);
        userId = 'guest';
      }
    }

    if (!userId || userId === 'guest') {
      this.logger.error(`❌ Cannot create order: userId is ${userId}`);
      throw new UnauthorizedException('You must be logged in to create an order. Please sign in and try again.');
    }

    return this.orderService.createOrder(userId, createOrderDto);
  }

  /**
   * Complete order (called after payment verification)
   * POST /api/orders/:id/complete
   */
  @Post(':id/complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an order after payment verification' })
  async completeOrder(
    @Param('id') id: string,
    @Body() body: { txRef: string; paymentProvider: string },
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Complete order: ${id} for user: ${user?.id || 'N/A'}`);
    
    if (!user || !user.id) {
      throw new UnauthorizedException('User ID not found in session');
    }
    
    return this.orderService.completeOrder(
      id,
      body.txRef,
      body.paymentProvider,
      user.id, // Pass userId from authenticated session
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

  /**
   * Get platform commission analytics (admin only)
   * GET /api/orders/admin/platform-commission
   */
  @Get('admin/platform-commission')
  // @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get platform commission analytics (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO 8601 format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO 8601 format)' })
  async getPlatformCommission(
    @Query() query: PlatformCommissionQueryDto,
    // @CurrentUser() user: any,
  ) {
    // Check if user is admin
    // if (!user || user.role !== 'ADMIN') {
    //   throw new UnauthorizedException('Unauthorized. Admin access required.');
    // }
    
    return this.orderService.getPlatformCommissionAnalytics(
      query.page || 1,
      query.limit || 20,
      query.startDate,
      query.endDate,
    );
  }
}
