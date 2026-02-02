import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  UnauthorizedException,
  ParseIntPipe,
} from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { TransactionsQueryDto } from "./dto";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { AuthGuard } from "../../core/guards/auth.guard";
import { PaymentStatus } from "@prisma/client";

@ApiTags("Transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Get all transactions with pagination and filters
   * GET /api/transactions
   */
  @Get()
  @ApiOperation({ summary: "Get all transactions with pagination and filters" })
  async findAll(@Query() query: TransactionsQueryDto) {
    return this.transactionsService.findAll(
      query.page || 1,
      query.limit || 20,
      query.search,
      query.status,
      query.provider,
    );
  }

  /**
   * Get user's transactions (for logged-in user)
   * GET /api/transactions/my-transactions
   */
  @Get("my-transactions")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get transactions for the authenticated user" })
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
  @ApiQuery({
    name: "status",
    required: false,
    enum: PaymentStatus,
    description: "Filter by transaction status",
  })
  @ApiQuery({
    name: "provider",
    required: false,
    type: String,
    description: "Filter by payment provider (chapa, paypal)",
  })
  async getMyTransactions(
    @Request() req: any,
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query("status") status?: PaymentStatus,
    @Query("provider") provider?: string,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    // Use the new method that returns all transactions (buyer, seller, withdrawals)
    return this.transactionsService.getAllUserTransactions(
      userId,
      page,
      limit,
      status,
    );
  }

  /**
   * Get user's transaction statistics (for charts)
   * GET /api/transactions/my-transactions/stats
   */
  @Get("my-transactions/stats")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Get transaction statistics for the authenticated user",
  })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["week", "month", "year"],
    description: "Time period for statistics (default: month)",
  })
  async getMyTransactionStats(
    @Request() req: any,
    @Query("period") period: "week" | "month" | "year" = "month",
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    return this.transactionsService.getUserTransactionStats(userId, period);
  }

  /**
   * Get transaction by ID
   * GET /api/transactions/:id
   */
  @Get(":id")
  @ApiOperation({ summary: "Get a transaction by ID" })
  async findOne(@Param("id") id: string) {
    return this.transactionsService.findOne(id);
  }
}
