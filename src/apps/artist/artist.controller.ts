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
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ArtistService } from "./artist.service";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";
import { AuthGuard } from "@/core/guards/auth.guard";
import { Public } from "../../core/decorators/public.decorator";

@ApiTags("Artists")
@Controller("artist")
export class ArtistController {
  private readonly logger = new Logger(ArtistController.name);

  constructor(private readonly artistService: ArtistService) {}

  /**
   * Get artist earnings statistics
   * GET /api/artist/earnings
   */
  @Get("earnings")
  @UseGuards(AuthGuard)
  async getEarnings(@Request() req: any) {
    // Safely extract userId from header or session
    const xUserId = req.headers["x-user-id"];
    const userId = (Array.isArray(xUserId) ? xUserId[0] : xUserId) || req.user?.id;

    const logDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    fs.appendFileSync(path.join(logDir, "debug.log"), `[${new Date().toISOString()}] getEarnings: userId=${userId}, x-user-id=${xUserId}, user=${JSON.stringify(req.user)}\n`);

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    this.logger.log(`Get earnings for user: ${userId}`);
    return this.artistService.getEarningsStats(userId);
  }

  /**
   * Get withdrawal history
   * GET /api/artist/withdrawals
   */
  @Get("withdrawals")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get withdrawal history for artist" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  async getWithdrawals(
    @Request() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    // Safely extract userId from header or session
    const xUserId = req.headers["x-user-id"];
    const userId = (Array.isArray(xUserId) ? xUserId[0] : xUserId) || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    // Safely parse pagination parameters
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const pageNum = isNaN(parsedPage) ? 1 : parsedPage;
    const limitNum = isNaN(parsedLimit) ? 20 : parsedLimit;

    this.logger.log(
      `Get withdrawals for user: ${userId}, page: ${pageNum}, limit: ${limitNum}`,
    );
    return this.artistService.getWithdrawalHistory(userId, pageNum, limitNum);
  }

  /**
   * Request withdrawal
   * POST /api/artist/withdrawal/request
   */
  @Post("withdrawal/request")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request withdrawal for authenticated artist" })
  async requestWithdrawal(
    @Body() requestWithdrawalDto: RequestWithdrawalDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    this.logger.log(
      `Withdrawal request from user ${userId}: $${requestWithdrawalDto.amount}`,
    );
    return this.artistService.requestWithdrawal(
      userId,
      requestWithdrawalDto.amount,
      requestWithdrawalDto.iban,
      requestWithdrawalDto.bankCode,
      requestWithdrawalDto.accountName,
    );
  }

  /**
   * Get payment methods
   * GET /api/artist/payment-methods
   */
  @Get("payment-methods")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get payment methods for authenticated artist" })
  async getPaymentMethods(@Request() req: any) {
    // Safely extract userId from header or session
    const xUserId = req.headers["x-user-id"];
    const userId = (Array.isArray(xUserId) ? xUserId[0] : xUserId) || req.user?.id;

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    this.logger.log(`Get payment methods for user: ${userId}`);
    return this.artistService.getPaymentMethods(userId);
  }

  /**
   * Update payment method
   * PUT /api/artist/payment-method
   */
  @Put("payment-method")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update payment method for authenticated artist" })
  async updatePaymentMethod(
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    this.logger.log(`Update payment method for user: ${userId}`);
    return this.artistService.updatePaymentMethod(
      userId,
      updatePaymentMethodDto.accountHolder,
      updatePaymentMethodDto.iban,
      updatePaymentMethodDto.bicCode,
    );
  }

  /**
   * Get all unique IBANs collected from the artist's artworks
   * GET /api/artist/ibans
   */
  @Get("ibans")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get all unique IBANs from the artist's artworks" })
  async getIbans(@Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }
    return this.artistService.getCollectedIbans(userId);
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
    @Query("search") search?: string,
    @Query("country") country?: string,
    @Query("talentTypeId") talentTypeId?: string,
    @Query("email") email?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    this.logger.log(
      `Get all artists - page: ${pageNum}, limit: ${limitNum}, search: ${search || "none"}, country: ${country || "none"}, talentTypeId: ${talentTypeId || "none"}, email: ${email || "none"}`,
    );
    return this.artistService.getAllArtists(
      pageNum,
      limitNum,
      search,
      country,
      talentTypeId,
      email,
    );
  }

  /**
   * Get all artists for admin
   * GET /api/artist/admin
   */
  @Get("admin")
  @UseGuards(AuthGuard)
  async getAllArtistsAdmin(
    @Request() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("country") country?: string,
    @Query("talentTypeId") talentTypeId?: string,
    @Query("email") email?: string,
  ) {
    const userId = req.user?.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    return this.artistService.findAllAdmin(
      pageNum,
      limitNum,
      search,
      country,
      talentTypeId,
      email,
      userId,
    );
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
    @Query("limit") limit?: string,
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
    @Query("talentTypeId") talentTypeId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(
      `Get trending artists - limit: ${limitNum}, talentTypeId: ${talentTypeId || "all"}`,
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
    @Query("limit") limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(
      `Get artists by talent type ${talentTypeId} - page: ${pageNum}, limit: ${limitNum}`,
    );
    return this.artistService.getArtistsByTalentType(
      talentTypeId,
      pageNum,
      limitNum,
    );
  }
}
