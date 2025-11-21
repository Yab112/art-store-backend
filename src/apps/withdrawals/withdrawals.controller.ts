import { Controller, Get, Query, Param, Patch, Body } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsQueryDto, UpdateWithdrawalStatusDto } from './dto';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Withdrawals')
@Controller('withdrawals')
@ApiBearerAuth()
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

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
    return this.withdrawalsService.updateStatus(id, updateDto);
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

