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
  Param,
} from "@nestjs/common";
import { ArtistService } from "./artist.service";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";
import { Public } from "@/core/decorators/public.decorator";

@Controller("artist")
export class ArtistController {
  private readonly logger = new Logger(ArtistController.name);

  constructor(private readonly artistService: ArtistService) {}

  /**
   * Get artist earnings statistics
   * GET /api/artist/earnings
   */
  @Get("earnings")
  async getEarnings(@Request() req: any) {
    // In a real app, get userId from authenticated session
    // For now, we'll use a placeholder or from request
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new Error("User not authenticated");
    }

    this.logger.log(`Get earnings for user: ${userId}`);
    return this.artistService.getEarningsStats(userId);
  }

  /**
   * Get withdrawal history
   * GET /api/artist/withdrawals
   */
  @Get("withdrawals")
  async getWithdrawals(@Request() req: any) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new Error("User not authenticated");
    }

    this.logger.log(`Get withdrawals for user: ${userId}`);
    return this.artistService.getWithdrawalHistory(userId);
  }

  /**
   * Request withdrawal
   * POST /api/artist/withdrawal/request
   */
  @Post("withdrawal/request")
  @HttpCode(HttpStatus.OK)
  async requestWithdrawal(
    @Body() requestWithdrawalDto: RequestWithdrawalDto,
    @Request() req: any
  ) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new Error("User not authenticated");
    }

    this.logger.log(
      `Withdrawal request from user ${userId}: $${requestWithdrawalDto.amount}`
    );
    return this.artistService.requestWithdrawal(
      userId,
      requestWithdrawalDto.amount,
      requestWithdrawalDto.iban
    );
  }

  /**
   * Get payment methods
   * GET /api/artist/payment-methods
   */
  @Get("payment-methods")
  async getPaymentMethods(@Request() req: any) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new Error("User not authenticated");
    }

    this.logger.log(`Get payment methods for user: ${userId}`);
    return this.artistService.getPaymentMethods(userId);
  }

  /**
   * Update payment method
   * PUT /api/artist/payment-method
   */
  @Put("payment-method")
  @HttpCode(HttpStatus.OK)
  async updatePaymentMethod(
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
    @Request() req: any
  ) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new Error("User not authenticated");
    }

    this.logger.log(`Update payment method for user: ${userId}`);
    return this.artistService.updatePaymentMethod(
      userId,
      updatePaymentMethodDto.accountHolder,
      updatePaymentMethodDto.iban,
      updatePaymentMethodDto.bicCode
    );
  }

  /** 
   * Get all artists (public endpoint)
   * GET /api/artist/all
   */
  @Get("all")
  @Public()
  async getAllArtists(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    this.logger.log(
      `Get all artists - page: ${pageNum}, limit: ${limitNum}, search: ${search || "none"}`
    );
    return this.artistService.getAllArtists(pageNum, limitNum, search);
  }

  /**
   * Get top selling artists (public endpoint)
   * GET /api/artist/top-selling
   */
  @Get("top-selling")
  @Public()
  async getTopSellingArtists(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(`Get top selling artists - limit: ${limitNum}`);
    return this.artistService.getTopSellingArtists(limitNum);
  }

  /**
   * Get most viewed artists (public endpoint)
   * GET /api/artist/most-viewed
   */
  @Get("most-viewed")
  @Public()
  async getMostViewedArtists(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(`Get most viewed artists - limit: ${limitNum}`);
    return this.artistService.getMostViewedArtists(limitNum);
  }

  /**
   * Get similar artists (public endpoint)
   * GET /api/artist/similar/:artistId
   */
  @Get("similar/:artistId")
  @Public()
  async getSimilarArtists(
    @Param("artistId") artistId: string,
    @Query("limit") limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 6;
    this.logger.log(`Get similar artists for ${artistId} - limit: ${limitNum}`);
    return this.artistService.getSimilarArtists(artistId, limitNum);
  }

  /**
   * Get trending artists (public endpoint)
   * GET /api/artist/trending
   */
  @Get("trending")
  @Public()
  async getTrendingArtists(
    @Query("limit") limit?: string,
    @Query("talentTypeId") talentTypeId?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(
      `Get trending artists - limit: ${limitNum}, talentTypeId: ${talentTypeId || "all"}`
    );
    return this.artistService.getTrendingArtists(limitNum, talentTypeId);
  }

  /**
   * Get online artists (public endpoint)
   * GET /api/artist/online
   */
  @Get("online")
  @Public()
  async getOnlineArtists(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(`Get online artists - limit: ${limitNum}`);
    return this.artistService.getOnlineArtists(limitNum);
  }

  /**
   * Get artists by talent type (public endpoint)
   * GET /api/artist/by-talent-type/:talentTypeId
   */
  @Get("by-talent-type/:talentTypeId")
  @Public()
  async getArtistsByTalentType(
    @Param("talentTypeId") talentTypeId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(
      `Get artists by talent type ${talentTypeId} - page: ${pageNum}, limit: ${limitNum}`
    );
    return this.artistService.getArtistsByTalentType(
      talentTypeId,
      pageNum,
      limitNum
    );
  }
}
