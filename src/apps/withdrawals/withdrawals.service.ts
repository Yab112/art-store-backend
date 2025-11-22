import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { WithdrawalsQueryDto } from './dto/withdrawals-query.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { PaymentStatus } from '@prisma/client';
import { ArtistService } from '../artist/artist.service';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly artistService: ArtistService,
  ) {}

  /**
   * Get all withdrawals with pagination and filters
   */
  async findAll(query: WithdrawalsQueryDto) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { payoutAccount: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const withdrawals = await this.prisma.withdrawal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }) as any[];

    const total = await this.prisma.withdrawal.count({ where });

    // Fetch user data for withdrawals that have userId
    const userIds = withdrawals
      .map((w) => (w as any).userId)
      .filter((id): id is string => id !== null && id !== undefined);
    
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        userId: w.userId || null,
        user: w.userId && userMap.has(w.userId)
          ? {
              id: userMap.get(w.userId)!.id,
              name: userMap.get(w.userId)!.name,
              email: userMap.get(w.userId)!.email,
            }
          : null,
        payoutAccount: w.payoutAccount,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt || w.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get withdrawal statistics
   */
  async getStatistics() {
    const [total, byStatus] = await Promise.all([
      this.prisma.withdrawal.count(),
      this.prisma.withdrawal.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { amount: true },
      }),
    ]);

    const statusStats = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = {
          count: item._count.status,
          totalAmount: Number(item._sum.amount || 0),
        };
        return acc;
      },
      {} as Record<PaymentStatus, { count: number; totalAmount: number }>,
    );

    const totalAmount = await this.prisma.withdrawal.aggregate({
      _sum: { amount: true },
    });

    return {
      total,
      totalAmount: Number(totalAmount._sum.amount || 0),
      byStatus: statusStats,
    };
  }

  /**
   * Get withdrawal by ID with full details including artist earnings
   */
  async findOne(id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }

    // Get artist earnings stats if userId exists
    let earningsStats = null;
    if (withdrawal.userId) {
      try {
        const stats = await this.artistService.getEarningsStats(withdrawal.userId);
        earningsStats = stats.data;
      } catch (error) {
        this.logger.warn(`Failed to get earnings stats for user ${withdrawal.userId}:`, error);
      }
    }

    return {
      id: withdrawal.id,
      userId: withdrawal.userId,
      user: withdrawal.user
        ? {
            id: withdrawal.user.id,
            name: withdrawal.user.name,
            email: withdrawal.user.email,
            image: withdrawal.user.image,
          }
        : null,
      payoutAccount: withdrawal.payoutAccount,
      amount: Number(withdrawal.amount),
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      updatedAt: withdrawal.updatedAt,
      earningsStats,
    };
  }

  /**
   * Update withdrawal status
   */
  async updateStatus(id: string, updateDto: UpdateWithdrawalStatusDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }

    // Validate status transition
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.INITIATED]: [PaymentStatus.PROCESSING, PaymentStatus.COMPLETED, PaymentStatus.FAILED],
      [PaymentStatus.PROCESSING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
      [PaymentStatus.COMPLETED]: [], // Cannot change from completed
      [PaymentStatus.FAILED]: [PaymentStatus.INITIATED, PaymentStatus.PROCESSING], // Can retry
      [PaymentStatus.REFUNDED]: [], // Cannot change from refunded
    };

    const allowedStatuses = validTransitions[withdrawal.status];
    if (!allowedStatuses.includes(updateDto.status)) {
      throw new Error(
        `Invalid status transition from ${withdrawal.status} to ${updateDto.status}`,
      );
    }

    // If approving (COMPLETED), verify balance is sufficient
    if (updateDto.status === PaymentStatus.COMPLETED && withdrawal.userId) {
      try {
        const stats = await this.artistService.getEarningsStats(withdrawal.userId);
        const availableBalance = stats.data.availableBalance;
        const requestedAmount = Number(withdrawal.amount);

        if (requestedAmount > availableBalance) {
          throw new Error(
            `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)}`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to verify balance:', error);
        throw error;
      }
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: updateDto.status,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }) as any;

    this.logger.log(
      `Withdrawal ${id} status updated from ${withdrawal.status} to ${updateDto.status}`,
    );

    return {
      id: updated.id,
      userId: updated.userId,
      user: updated.user
        ? {
            id: updated.user.id,
            name: updated.user.name,
            email: updated.user.email,
            image: updated.user.image,
          }
        : null,
      payoutAccount: updated.payoutAccount,
      amount: Number(updated.amount),
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

