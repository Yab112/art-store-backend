import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { WithdrawalsQueryDto } from './dto/withdrawals-query.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { ArtistService } from '../artist/artist.service';
import { PaypalService } from '../payment/paypal.service';

// PaymentStatus enum - will be available after Prisma client regeneration
type PaymentStatus = 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'REFUNDED';
const PaymentStatus = {
  INITIATED: 'INITIATED' as PaymentStatus,
  PROCESSING: 'PROCESSING' as PaymentStatus,
  COMPLETED: 'COMPLETED' as PaymentStatus,
  FAILED: 'FAILED' as PaymentStatus,
  REJECTED: 'REJECTED' as PaymentStatus,
  REFUNDED: 'REFUNDED' as PaymentStatus,
};

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly artistService: ArtistService,
    private readonly paypalService: PaypalService,
  ) { }

  /**
   * Create a manual withdrawal request
   */
  async create(userId: string, createDto: any) { // Using any for DTO to avoid import issues in this tool call
    try {
      this.logger.log(`Creating manual withdrawal request for user: ${userId}`);

      // 1. Get current earnings/balance
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { earning: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Calculate already withdrawn or pending amounts
      const activeWithdrawals = await this.prisma.withdrawal.findMany({
        where: {
          userId,
          status: {
            in: [PaymentStatus.INITIATED, PaymentStatus.PROCESSING, PaymentStatus.COMPLETED],
          },
        },
      });

      const totalDeducted = activeWithdrawals.reduce(
        (sum, w) => sum + Number(w.amount),
        0
      );

      const totalEarnings = Number(user.earning || 0);
      const availableBalance = totalEarnings - totalDeducted;

      if (createDto.amount > availableBalance) {
        throw new BadRequestException(
          `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${createDto.amount.toFixed(2)}`
        );
      }

      // 3. Create the withdrawal request
      const withdrawal = await this.prisma.withdrawal.create({
        data: {
          userId,
          amount: new Decimal(createDto.amount),
          payoutAccount: createDto.payoutAccount,
          status: PaymentStatus.INITIATED,
        } as any,
      });

      this.logger.log(`✅ Withdrawal request created: ${withdrawal.id} for user ${userId}`);
      return withdrawal;
    } catch (error) {
      this.logger.error(`Failed to create withdrawal request: ${error.message}`);
      throw error;
    }
  }

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

    const userMap = new Map<string, { id: string; name: string | null; email: string }>(
      users.map((u) => [u.id, u])
    );

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
   * Get withdrawal by ID with full details including artist earnings and validation status
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
            emailVerified: true,
            banned: true,
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

    // Check current validation status (may have changed since request was created)
    let validationStatus = {
      canApprove: true,
      issues: [] as string[],
    };

    if (withdrawal.userId && withdrawal.user) {
      const user = withdrawal.user;
      const requestedAmount = Number(withdrawal.amount);

      // Check email verification
      if (!user.emailVerified) {
        validationStatus.canApprove = false;
        validationStatus.issues.push('Email not verified');
      }

      // Check if user is banned
      if (user.banned) {
        validationStatus.canApprove = false;
        validationStatus.issues.push('User account is banned');
      }

      // Check for active disputes
      const activeDisputes = await this.prisma.dispute.findMany({
        where: {
          targetUserId: withdrawal.userId,
          status: 'IN_PROGRESS',
        },
      });

      if (activeDisputes.length > 0) {
        validationStatus.canApprove = false;
        validationStatus.issues.push(`${activeDisputes.length} active dispute(s)`);
      }

      // Check balance
      if (earningsStats) {
        if (requestedAmount > earningsStats.availableBalance) {
          validationStatus.canApprove = false;
          validationStatus.issues.push(
            `Insufficient balance (Available: $${earningsStats.availableBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)})`,
          );
        }
      }

      // Check IBAN ownership
      const artwork = await this.prisma.artwork.findFirst({
        where: {
          userId: withdrawal.userId,
          iban: withdrawal.payoutAccount,
        },
      });

      if (!artwork) {
        validationStatus.canApprove = false;
        validationStatus.issues.push('IBAN does not belong to this artist');
      }
    }

    // Extract rejection reason from metadata if status is REJECTED or FAILED
    let rejectionReason = null;
    const withdrawalWithMetadata = withdrawal as any;
    const withdrawalStatus = withdrawal.status as string;
    if ((withdrawalStatus === 'REJECTED' || withdrawal.status === PaymentStatus.FAILED) && withdrawalWithMetadata.metadata) {
      const metadata = withdrawalWithMetadata.metadata as any;
      rejectionReason = metadata.rejectionReason || null;
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
          emailVerified: withdrawal.user.emailVerified,
          banned: withdrawal.user.banned,
        }
        : null,
      payoutAccount: withdrawal.payoutAccount,
      amount: Number(withdrawal.amount),
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      updatedAt: withdrawal.updatedAt,
      earningsStats,
      validationStatus,
      rejectionReason,
    };
  }

  /**
   * Create a transaction record for a completed withdrawal
   * This is called when withdrawal status changes to COMPLETED
   * @param withdrawalId - The withdrawal ID
   * @param userId - The seller's user ID
   * @param amount - The withdrawal amount
   * @param payoutAccount - The payout account (e.g., PayPal email)
   */
  async createWithdrawalTransaction(
    withdrawalId: string,
    userId: string,
    amount: Decimal | number,
    payoutAccount: string | null,
  ): Promise<void> {
    try {
      // Check if transaction already exists for this withdrawal (idempotency)
      const existingTransaction = await this.prisma.transaction.findFirst({
        where: {
          sellerId: userId,
          metadata: {
            path: ['withdrawalId'],
            equals: withdrawalId,
          },
        },
      });

      if (!existingTransaction) {
        const withdrawalTransaction = await this.prisma.transaction.create({
          data: {
            sellerId: userId,
            orderId: null, // Withdrawal transactions don't have orderId
            amount: new Decimal(amount),
            status: PaymentStatus.COMPLETED, // Money was successfully withdrawn
            metadata: {
              type: "WITHDRAWAL", // CRITICAL: This must be "WITHDRAWAL" for filtering
              withdrawalId: withdrawalId,
              payoutAccount: payoutAccount,
              completedAt: new Date().toISOString(),
            },
          },
        });

        this.logger.log(
          `[WITHDRAWAL-TX] ✅ Created withdrawal transaction for user ${userId}: ${Number(amount)} (Transaction ID: ${withdrawalTransaction.id}, Withdrawal ID: ${withdrawalId})`
        );
      } else {
        this.logger.log(
          `[WITHDRAWAL-TX] ⚠️ Transaction already exists for withdrawal ${withdrawalId} - skipping creation`
        );
      }
    } catch (txError: any) {
      // Log error but don't fail withdrawal update
      this.logger.error(
        `[WITHDRAWAL-TX] ❌ Failed to create transaction for withdrawal ${withdrawalId}:`,
        txError
      );
      this.logger.error(
        `[WITHDRAWAL-TX] Error: ${txError?.message || 'Unknown error'}`
      );
    }
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
    const validTransitions: Record<string, string[]> = {
      [PaymentStatus.INITIATED]: [PaymentStatus.PROCESSING, 'REJECTED'],
      [PaymentStatus.PROCESSING]: [PaymentStatus.COMPLETED, 'REJECTED'],
      [PaymentStatus.COMPLETED]: [], // Cannot change from completed
      [PaymentStatus.FAILED]: [PaymentStatus.INITIATED, PaymentStatus.PROCESSING], // Can retry (for payment failures)
      ['REJECTED']: [], // Cannot change from rejected
      [PaymentStatus.REFUNDED]: [], // Cannot change from refunded
    };

    const allowedStatuses = validTransitions[withdrawal.status];
    if (!allowedStatuses.includes(updateDto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${withdrawal.status} to ${updateDto.status}`,
      );
    }

    // If approving (PROCESSING = admin approval), verify balance and process payout
    if (updateDto.status === PaymentStatus.PROCESSING && withdrawal.userId) {
      try {
        // Verify balance is sufficient before processing
        const stats = await this.artistService.getEarningsStats(withdrawal.userId);
        const availableBalance = stats.data.availableBalance;
        const requestedAmount = Number(withdrawal.amount);

        if (requestedAmount > availableBalance) {
          throw new BadRequestException(
            `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)}`,
          );
        }

        // Get user email for PayPal payout
        const user = await this.prisma.user.findUnique({
          where: { id: withdrawal.userId },
          select: { email: true, name: true },
        });

        if (!user || !user.email) {
          throw new BadRequestException('User email not found. Cannot process PayPal payout.');
        }

        // Process PayPal Payout
        this.logger.log(
          `Processing PayPal payout for withdrawal ${id}: $${requestedAmount.toFixed(2)} to ${user.email}`,
        );

        let payoutResult;
        try {
          payoutResult = await this.paypalService.processPayout(
            user.email,
            requestedAmount,
            'USD',
            `Withdrawal payout for withdrawal request ${id}`,
          );

          if (!payoutResult || !payoutResult.success) {
            const errorMessage = payoutResult?.message || 'PayPal payout failed';
            this.logger.error(`PayPal payout error: ${errorMessage}`);

            // Check if it's a configuration issue
            if (errorMessage.includes('credentials') || errorMessage.includes('not configured')) {
              throw new BadRequestException(
                `PayPal is not properly configured. Please check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables. Error: ${errorMessage}`,
              );
            }

            throw new BadRequestException(`PayPal payout failed: ${errorMessage}`);
          }
        } catch (error: any) {
          this.logger.error(`PayPal payout processing error: ${error.message || error}`);

          // Re-throw with more context
          if (error instanceof HttpException) {
            throw error; // Re-throw HttpExceptions as-is
          }

          throw new BadRequestException(
            `Failed to process PayPal payout: ${error.message || 'Unknown error'}`,
          );
        }

        // Log transaction
        this.logger.log(
          `PayPal payout initiated - Batch ID: ${payoutResult.payoutBatchId}, Initial Status: ${payoutResult.status}`,
        );

        // Store payout batch ID in metadata for webhook matching
        // Using raw query to avoid Prisma type errors if migration not run
        try {
          const result = await this.prisma.$executeRawUnsafe(
            `UPDATE "Withdrawal" SET "payoutBatchId" = $1 WHERE id = $2`,
            payoutResult.payoutBatchId,
            id,
          );
          if (result > 0) {
            this.logger.log(`Stored payout batch ID in withdrawal ${id}`);
          }
        } catch (error: any) {
          // Column doesn't exist yet - that's okay, store in metadata as fallback
          this.logger.warn(
            `payoutBatchId column not found (run migration). Storing in metadata. Batch ID: ${payoutResult.payoutBatchId}`,
          );
          // Store in metadata as fallback
          const withdrawalWithMetadata = withdrawal as any;
          const existingMetadata = (withdrawalWithMetadata.metadata || {}) as any;
          await this.prisma.withdrawal.update({
            where: { id },
            data: {
              metadata: {
                ...existingMetadata,
                payoutBatchId: payoutResult.payoutBatchId,
                payoutInitiatedAt: new Date().toISOString(),
              } as any,
            } as any,
          });
        }

        // Keep status as PROCESSING - webhook will update to final status (COMPLETED, FAILED, REFUNDED)
        // PayPal payouts are asynchronous, so we wait for webhook confirmation
        this.logger.log(
          `Withdrawal ${id} remains in PROCESSING status. Final status will be updated via PayPal webhook.`,
        );
      } catch (error: any) {
        this.logger.error(`Failed to process payout for withdrawal ${id}:`, error);
        // Mark as FAILED if payout processing fails
        (updateDto as any).status = PaymentStatus.FAILED;
        throw error;
      }
    }

    // If rejecting (REJECTED), store rejection reason in metadata
    const updateStatus = updateDto.status as string;
    if (updateStatus === 'REJECTED' && withdrawal.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: withdrawal.userId },
        select: { email: true, name: true },
      });

      const rejectionReason = updateDto.reason || 'Withdrawal request rejected by admin';

      this.logger.log(
        `Withdrawal ${id} rejected. Reason: ${rejectionReason}. Funds remain in available balance.`,
      );

      // Store rejection reason in metadata (metadata field exists in schema but may not be in Prisma client)
      const withdrawalWithMetadata = withdrawal as any;
      const existingMetadata = (withdrawalWithMetadata.metadata || {}) as any;
      const updatedMetadata = {
        ...existingMetadata,
        rejectionReason,
        rejectedAt: new Date().toISOString(),
      };

      // Note: Metadata will be included in the main update below
      // TODO: Send email notification to artist about rejection
      // await this.emailService.sendWithdrawalRejectedEmail({
      //   to: user?.email,
      //   amount: Number(withdrawal.amount),
      //   withdrawalId: id,
      //   reason: rejectionReason,
      // });
    }

    // If directly setting to COMPLETED (for manual completion or retry), verify balance
    if (updateDto.status === PaymentStatus.COMPLETED && withdrawal.userId) {
      try {
        // Get user earning
        const user = await this.prisma.user.findUnique({
          where: { id: withdrawal.userId },
          select: { earning: true },
        });

        if (!user) {
          throw new Error("User not found");
        }

        // Get total withdrawn amount (completed withdrawals)
        const completedWithdrawals = await this.prisma.withdrawal.findMany({
          where: {
            userId: withdrawal.userId,
            status: PaymentStatus.COMPLETED,
            // Exclude current withdrawal if it's already marked as completed
            NOT: { id: withdrawal.id },
          },
        });

        const totalWithdrawn = completedWithdrawals.reduce(
          (sum, w) => sum + Number(w.amount),
          0
        );

        const earning = Number(user.earning || 0);
        const availableBalance = earning - totalWithdrawn;
        const requestedAmount = Number(withdrawal.amount);

        if (requestedAmount > availableBalance) {
          throw new BadRequestException(
            `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${requestedAmount.toFixed(2)}`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to verify balance:', error);
        throw error;
      }
    }

    // Prepare update data
    const updateData: any = {
      status: updateDto.status,
      updatedAt: new Date(),
    };

    // Add metadata if rejecting
    const updateStatusForMetadata = updateDto.status as string;
    if (updateStatusForMetadata === 'REJECTED') {
      const withdrawalWithMetadata = withdrawal as any;
      const existingMetadata = (withdrawalWithMetadata.metadata || {}) as any;
      updateData.metadata = {
        ...existingMetadata,
        rejectionReason: updateDto.reason || 'Withdrawal request rejected by admin',
        rejectedAt: new Date().toISOString(),
      };
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: updateData,
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
      `[WITHDRAWAL-UPDATE] Withdrawal ${id} status updated from ${withdrawal.status} to ${updateDto.status}`,
    );

    // Create transaction record when withdrawal is completed
    // This represents money being withdrawn from the seller's account
    if (updateDto.status === PaymentStatus.COMPLETED && withdrawal.userId) {
      await this.createWithdrawalTransaction(withdrawal.id, withdrawal.userId, withdrawal.amount, withdrawal.payoutAccount);
    }

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

