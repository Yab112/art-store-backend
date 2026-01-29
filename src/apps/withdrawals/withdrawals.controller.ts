import { Controller, Get, Post, Query, Param, Patch, Body, HttpException, HttpStatus, Logger, UseGuards, Request } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsQueryDto, UpdateWithdrawalStatusDto, CreateWithdrawalDto } from './dto';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/core/guards/auth.guard';

@ApiTags('Withdrawals')
@Controller('withdrawals')
@ApiBearerAuth()
export class WithdrawalsController {
  private readonly logger = new Logger(WithdrawalsController.name);

  constructor(private readonly withdrawalsService: WithdrawalsService) { }

  /**
   * Create a manual withdrawal request
   * POST /api/withdrawals
   */
  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a manual withdrawal request' })
  async create(
    @Body() createDto: CreateWithdrawalDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.withdrawalsService.create(userId, createDto);
  }

  /**
   * Get all withdrawals with pagination and filters
   * GET /api/withdrawals
   */
  @Get()
  @ApiOperation({ summary: 'Get all withdrawals' })
  async findAll(@Query() query: WithdrawalsQueryDto) {
    return this.withdrawalsService.findAll(query);
  }

  /**
   * Get withdrawal by ID with full details
   * GET /api/withdrawals/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get withdrawal by ID with full details' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID' })
  async findOne(@Param('id') id: string) {
    return this.withdrawalsService.findOne(id);
  }

  /**
   * Update withdrawal status
   * PATCH /api/withdrawals/:id/status
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update withdrawal status (approve/reject)' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateWithdrawalStatusDto,
  ) {
    try {
      return await this.withdrawalsService.updateStatus(id, updateDto);
    } catch (error: any) {
      this.logger.error(`Failed to update withdrawal ${id} status:`, error);

      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Otherwise, wrap it in a proper HTTP exception
      const message = error.message || 'Failed to update withdrawal status';
      const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          statusCode,
          message,
          error: 'Internal server error',
        },
        statusCode,
      );
    }
  }

  /**
   * Get withdrawal statistics
   * GET /api/withdrawals/statistics
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Get withdrawal statistics' })
  async getStatistics() {
    return this.withdrawalsService.getStatistics();
  }
}

