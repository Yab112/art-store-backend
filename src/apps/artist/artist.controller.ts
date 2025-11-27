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
  Query,
  ParseIntPipe,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ArtistService } from './artist.service';
import { ArtworkService } from '../artwork/artwork.service';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { AuthGuard } from '@/core/guards/auth.guard';

@ApiTags('Artists')
@Controller('artist')
export class ArtistController {
  private readonly logger = new Logger(ArtistController.name);

  constructor(
    private readonly artistService: ArtistService,
    private readonly artworkService: ArtworkService,
  ) {}

  /**
   * Get trending artists based on engagement metrics
   * GET /api/artist/trending
   */
  @Get('trending')
  @ApiOperation({ 
    summary: 'Get trending artists',
    description: 'Returns artists sorted by engagement metrics (views, likes, comments, favorites, artwork count)'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Number of trending artists to return (default: 10)',
    example: 10
  })
  async getTrendingArtists(
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    const artists = await this.artworkService.getTrendingArtists(limit);
    return {
      success: true,
      artists,
    };
  }

  /**
   * Get artist earnings statistics
   * GET /api/artist/earnings
   */
  @Get('earnings')
  @UseGuards(AuthGuard)
  async getEarnings(@Request() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    this.logger.log(`Get earnings for user: ${userId}`);
    return this.artistService.getEarningsStats(userId);
  }

  /**
   * Get withdrawal history
   * GET /api/artist/withdrawals
   */
  @Get('withdrawals')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get withdrawal history for artist' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  async getWithdrawals(
    @Request() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    this.logger.log(`Get withdrawals for user: ${userId}, page: ${page}, limit: ${limit}`);
    return this.artistService.getWithdrawalHistory(userId, page, limit);
  }

  /**
   * Request withdrawal
   * POST /api/artist/withdrawal/request
   */
  @Post('withdrawal/request')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestWithdrawal(
    @Body() requestWithdrawalDto: RequestWithdrawalDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
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
