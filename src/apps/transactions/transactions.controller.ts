import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsQueryDto } from './dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Get all transactions with pagination and filters
   * GET /api/transactions
   */
  @Get()
  @ApiOperation({ summary: 'Get all transactions with pagination and filters' })
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
   * Get transaction by ID
   * GET /api/transactions/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  async findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }
}

