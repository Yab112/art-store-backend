import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all transactions with pagination and filters
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: PaymentStatus,
    provider?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      // Note: Provider filtering will be done after fetch since Prisma JSON filtering is complex
      // We'll filter in memory for now

      // Search by buyer email (from order) or transaction ID
      if (search) {
        where.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          {
            order: {
              buyerEmail: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      // First, get all transactions matching status and search
      const allTransactions = await this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              buyerEmail: true,
              totalAmount: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          paymentGateway: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Filter by provider if provided (from metadata)
      let filteredTransactions = allTransactions;
      if (provider) {
        filteredTransactions = allTransactions.filter((tx) => {
          const metadata = tx.metadata as any;
          const txProvider = metadata?.paymentProvider || metadata?.provider || '';
          return txProvider.toLowerCase() === provider.toLowerCase();
        });
      }

      // Calculate total before pagination
      const total = filteredTransactions.length;

      // Apply pagination
      const transactions = filteredTransactions.slice(skip, skip + limit);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                artwork: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        paymentGateway: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }
}

