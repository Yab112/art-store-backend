import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  HttpCode,
  HttpStatus, 
  Logger,
  Request,
} from '@nestjs/common';
import { ArtistService } from './artist.service';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Controller('artist')
export class ArtistController {
  private readonly logger = new Logger(ArtistController.name);

  constructor(private readonly artistService: ArtistService) {}

  /**
   * Get artist earnings statistics
   * GET /api/artist/earnings
   */
  @Get('earnings')
  async getEarnings(@Request() req: any) {
    // In a real app, get userId from authenticated session
    // For now, we'll use a placeholder or from request
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      throw new Error('User not authenticated');
    }

    this.logger.log(`Get earnings for user: ${userId}`);
    return this.artistService.getEarningsStats(userId);
  }

  /**
   * Get withdrawal history
   * GET /api/artist/withdrawals
   */
  @Get('withdrawals')
  async getWithdrawals(@Request() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      throw new Error('User not authenticated');
    }

    this.logger.log(`Get withdrawals for user: ${userId}`);
    return this.artistService.getWithdrawalHistory(userId);
  }

  /**
   * Request withdrawal
   * POST /api/artist/withdrawal/request
   */
  @Post('withdrawal/request')
  @HttpCode(HttpStatus.OK)
  async requestWithdrawal(
    @Body() requestWithdrawalDto: RequestWithdrawalDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      throw new Error('User not authenticated');
    }

    this.logger.log(
      `Withdrawal request from user ${userId}: $${requestWithdrawalDto.amount}`,
    );
    return this.artistService.requestWithdrawal(
      userId,
      requestWithdrawalDto.amount,
      requestWithdrawalDto.iban,
    );
  }

  /**
   * Get payment methods
   * GET /api/artist/payment-methods
   */
  @Get('payment-methods')
  async getPaymentMethods(@Request() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      throw new Error('User not authenticated');
    }

    this.logger.log(`Get payment methods for user: ${userId}`);
    return this.artistService.getPaymentMethods(userId);
  }

  /**
   * Update payment method
   * PUT /api/artist/payment-method
   */
  @Put('payment-method')
  @HttpCode(HttpStatus.OK)
  async updatePaymentMethod(
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      throw new Error('User not authenticated');
    }

    this.logger.log(`Update payment method for user: ${userId}`);
    return this.artistService.updatePaymentMethod(
      userId,
      updatePaymentMethodDto.accountHolder,
      updatePaymentMethodDto.iban,
      updatePaymentMethodDto.bicCode,
    );
  }
}
