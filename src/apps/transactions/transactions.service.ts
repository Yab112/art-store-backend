import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PaymentStatus } from '@prisma/client';
// If PaymentStatus is not available, use: type PaymentStatus = 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'REFUNDED';

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
   * Get transactions by user ID (buyer transactions)
   * Buyer transactions have orderId set and order.userId matches the authenticated user
   * This ensures we get transactions for the actual user who made the purchase,
   * not just based on email (which might be different, e.g., friend's email)
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: PaymentStatus,
    provider?: string,
  ) {
    try {
      this.logger.log(`[BUYER-TX] Getting transactions for buyer userId: ${userId}`);
      const skip = (page - 1) * limit;

      // Get user email for fallback query (for backward compatibility with old orders)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      // Build where clause - filter by user's ID from order
      // Buyer transactions have orderId set (not null) and order.userId matches
      // Also check buyerEmail as fallback for old orders that might not have userId set
      const where: any = {
        orderId: { not: null }, // Only buyer transactions have orderId
        order: {
          OR: [
            { userId: userId }, // Primary: match by userId (authenticated user)
            ...(user?.email ? [{ buyerEmail: user.email }] : []), // Fallback: match by email for old orders
          ],
        },
      };

      if (status) {
        where.status = status;
      }

      // Search by transaction ID or order ID
      if (search) {
        where.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          {
            order: {
              id: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      // Get all transactions for this user
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
              items: {
                include: {
                  artwork: {
                    select: {
                      id: true,
                      title: true,
                      photos: true,
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

      this.logger.log(`[BUYER-TX] Found ${allTransactions.length} transactions for buyer userId: ${userId}`);

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

      this.logger.log(`[BUYER-TX] Returning ${transactions.length} transactions (page ${page} of ${Math.ceil(total / limit)})`);

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
      this.logger.error('[BUYER-TX] Failed to fetch user transactions:', error);
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

  /**
   * Get user's transactions by userId
   * Fetches transactions for orders created by the user
   */
  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: PaymentStatus,
    provider?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      this.logger.log(`Fetching transactions for userId: ${userId}, page: ${page}, limit: ${limit}`);

      // Get all orders for this user
      const userOrders = await this.prisma.order.findMany({
        where: {
          userId: userId,
        } as any,
        select: {
          id: true,
        },
      });

      const orderIds = userOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        return {
          transactions: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        };
      }

      // Build where clause for transactions
      const where: any = {
        orderId: {
          in: orderIds,
        },
      };

      if (status) {
        where.status = status;
      }

      // Get all transactions for user's orders
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
              items: {
                select: {
                  id: true,
                  artworkId: true,
                  quantity: true,
                  price: true,
                  artwork: {
                    select: {
                      id: true,
                      title: true,
                      photos: true,
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

      // Format transactions for response
      const formattedTransactions = transactions.map((tx) => {
        const txWithDates = tx as any;
        return {
          id: tx.id,
          orderId: tx.orderId,
          amount: Number(tx.amount),
          status: tx.status,
          createdAt: tx.createdAt,
          updatedAt: txWithDates.updatedAt || tx.createdAt, // Fallback to createdAt if updatedAt not available
          metadata: tx.metadata,
          order: tx.order,
          paymentGateway: tx.paymentGateway,
          // Extract payment provider from metadata
          provider: (tx.metadata as any)?.paymentProvider || (tx.metadata as any)?.provider || null,
        };
      });

      return {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch transactions for userId ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's transaction statistics for charts
   * Returns aggregated data by date, status, and provider
   */
  async getUserTransactionStats(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    try {
      this.logger.log(`Fetching transaction statistics for userId: ${userId}, period: ${period}`);

      // Get all orders for this user
      const userOrders = await this.prisma.order.findMany({
        where: {
          userId: userId,
        } as any,
        select: {
          id: true,
        },
      });

      const orderIds = userOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        return {
          byDate: [],
          byStatus: {},
          byProvider: {},
          totalAmount: 0,
          totalCount: 0,
        };
      }

      // Calculate date range based on period
      const now = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Get all transactions for user's orders
      const transactions = await this.prisma.transaction.findMany({
        where: {
          orderId: {
            in: orderIds,
          },
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group by date with proper sorting
      const byDateMap = new Map<string, { date: string; dateValue: Date; amount: number; count: number }>();
      
      transactions.forEach((tx) => {
        const date = new Date(tx.createdAt);
        let dateKey: string;
        let dateValue: Date;
        
        // Normalize date to start of period for grouping
        switch (period) {
          case 'week':
            // Group by day of week
            dateValue = new Date(date);
            dateValue.setHours(0, 0, 0, 0);
            dateKey = dateValue.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            break;
          case 'month':
            // Group by day
            dateValue = new Date(date);
            dateValue.setHours(0, 0, 0, 0);
            dateKey = dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            break;
          case 'year':
            // Group by month
            dateValue = new Date(date.getFullYear(), date.getMonth(), 1);
            dateKey = dateValue.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            break;
          default:
            dateValue = new Date(date);
            dateValue.setHours(0, 0, 0, 0);
            dateKey = dateValue.toLocaleDateString('en-US');
        }

        const existing = byDateMap.get(dateKey) || { date: dateKey, dateValue, amount: 0, count: 0 };
        existing.amount += Number(tx.amount);
        existing.count += 1;
        byDateMap.set(dateKey, existing);
      });

      // Sort by actual date value, not string
      const byDate = Array.from(byDateMap.values())
        .map(item => ({ date: item.date, amount: item.amount, count: item.count }))
        .sort((a, b) => {
          const dateA = byDateMap.get(a.date)?.dateValue || new Date(0);
          const dateB = byDateMap.get(b.date)?.dateValue || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });

      // Group by status
      const byStatus: Record<string, { count: number; amount: number }> = {};
      transactions.forEach((tx) => {
        const status = tx.status;
        if (!byStatus[status]) {
          byStatus[status] = { count: 0, amount: 0 };
        }
        byStatus[status].count += 1;
        byStatus[status].amount += Number(tx.amount);
      });

      // Group by provider
      const byProvider: Record<string, { count: number; amount: number }> = {};
      transactions.forEach((tx) => {
        const metadata = tx.metadata as any;
        const provider = metadata?.paymentProvider || metadata?.provider || 'unknown';
        if (!byProvider[provider]) {
          byProvider[provider] = { count: 0, amount: 0 };
        }
        byProvider[provider].count += 1;
        byProvider[provider].amount += Number(tx.amount);
      });

      const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const totalCount = transactions.length;

      return {
        byDate,
        byStatus,
        byProvider,
        totalAmount,
        totalCount,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch transaction statistics for userId ${userId}:`, error);
      throw error;
    }
  }
}

