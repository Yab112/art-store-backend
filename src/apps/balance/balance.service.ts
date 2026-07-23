import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { SellerLedgerEntryType, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

export type EarningProvider = "paypal" | "chapa";

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Withdrawable =
   *   earning*(cache / historical credits)
   *   + ledger adjustments that affect cash (DISPUTE_REFUND_DEBIT)
   *   - completed withdrawals
   *   - reserved disputed amounts
   *   - unreleased pending credits (Phase 2 hold)
   */
  async getWithdrawable(
    userId: string,
    provider: EarningProvider,
  ): Promise<{
    available: number;
    creditedCache: number;
    ledgerDebits: number;
    withdrawn: number;
    reservedDisputed: number;
    reservedPending: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { earningPaypal: true, earningChapa: true },
    });
    const creditedCache =
      provider === "paypal"
        ? Number(user?.earningPaypal || 0)
        : Number(user?.earningChapa || 0);

    const method = provider === "paypal" ? "PAYPAL" : "CHAPA";
    const withdrawals = await this.prisma.withdrawal.aggregate({
      where: {
        userId,
        method,
        status: { in: ["COMPLETED", "PROCESSING"] },
      },
      _sum: { amount: true },
    });
    const withdrawn = Number(withdrawals._sum.amount || 0);

    const ledgerDebits = await this.sumLedger(
      userId,
      provider,
      "DISPUTE_REFUND_DEBIT",
    );

    const reservedDisputed = await this.getReservedDisputedAmount(
      userId,
      provider,
    );
    const reservedPending = await this.getReservedPendingAmount(
      userId,
      provider,
    );

    // earning* already includes order credits; debits are negative ledger amounts.
    // Pending reservation holds unreleased credits that sit inside earning* from dual-write era
    // OR for Phase 2 when we stop increasing earning* until release.
    const available = Math.max(
      0,
      creditedCache + ledgerDebits - withdrawn - reservedDisputed - reservedPending,
    );

    return {
      available,
      creditedCache,
      ledgerDebits,
      withdrawn,
      reservedDisputed,
      reservedPending,
    };
  }

  async getReservedDisputedAmount(
    userId: string,
    provider: EarningProvider,
  ): Promise<number> {
    const disputes = await this.prisma.dispute.findMany({
      where: {
        targetUserId: userId,
        OR: [
          {
            status: {
              in: ["IN_PROGRESS", "WAITING_FOR_RETURN", "READY_FOR_REFUND"],
            },
          },
          {
            refund: {
              status: { in: ["PROCESSING", "MANUAL_REVIEW", "PENDING"] },
            },
          },
        ],
      },
      select: {
        reservedAmount: true,
        reservedProvider: true,
        refund: { select: { status: true } },
      },
    });

    return disputes.reduce((sum, d) => {
      if (d.reservedProvider && d.reservedProvider !== provider) return sum;
      return sum + Number(d.reservedAmount || 0);
    }, 0);
  }

  async getReservedPendingAmount(
    userId: string,
    provider: EarningProvider,
  ): Promise<number> {
    const [pending, released, cancelled] = await Promise.all([
      this.sumLedger(userId, provider, "ORDER_CREDIT_PENDING"),
      this.sumLedger(userId, provider, "PENDING_RELEASE"),
      this.sumLedger(userId, provider, "PENDING_CANCELLED"),
    ]);
    // pending and released/cancelled are positive amounts tracking the same units
    return Math.max(0, pending - released - cancelled);
  }

  private async sumLedger(
    userId: string,
    provider: EarningProvider,
    type: SellerLedgerEntryType,
  ): Promise<number> {
    const agg = await this.prisma.sellerLedgerEntry.aggregate({
      where: { userId, provider, type },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  }

  async recordPendingCredit(params: {
    userId: string;
    orderId: string;
    amount: number;
    provider: EarningProvider;
    tx?: Prisma.TransactionClient;
  }) {
    const db = params.tx || this.prisma;
    const existing = await db.sellerLedgerEntry.findFirst({
      where: {
        orderId: params.orderId,
        userId: params.userId,
        type: "ORDER_CREDIT_PENDING",
        provider: params.provider,
      },
    });
    if (existing) return existing;

    return db.sellerLedgerEntry.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        orderId: params.orderId,
        amount: new Decimal(params.amount),
        provider: params.provider,
        type: "ORDER_CREDIT_PENDING",
        metadata: { source: "order_paid" },
      },
    });
  }

  async releasePendingCredit(params: {
    userId: string;
    orderId: string;
    provider: EarningProvider;
    tx?: Prisma.TransactionClient;
  }) {
    const db = params.tx || this.prisma;
    const pending = await db.sellerLedgerEntry.findFirst({
      where: {
        orderId: params.orderId,
        userId: params.userId,
        type: "ORDER_CREDIT_PENDING",
        provider: params.provider,
      },
    });
    if (!pending) return null;

    const already = await db.sellerLedgerEntry.findFirst({
      where: {
        orderId: params.orderId,
        type: { in: ["PENDING_RELEASE", "PENDING_CANCELLED"] },
        provider: params.provider,
      },
    });
    if (already) return already;

    return db.sellerLedgerEntry.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        orderId: params.orderId,
        amount: pending.amount,
        provider: params.provider,
        type: "PENDING_RELEASE",
        metadata: { source: "order_completed_or_seller_wins" },
      },
    });
  }

  async cancelPendingCredit(params: {
    userId: string;
    orderId: string;
    provider: EarningProvider;
    disputeId?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const db = params.tx || this.prisma;
    const pending = await db.sellerLedgerEntry.findFirst({
      where: {
        orderId: params.orderId,
        userId: params.userId,
        type: "ORDER_CREDIT_PENDING",
        provider: params.provider,
      },
    });
    if (!pending) return null;

    const already = await db.sellerLedgerEntry.findFirst({
      where: {
        orderId: params.orderId,
        type: { in: ["PENDING_RELEASE", "PENDING_CANCELLED"] },
        provider: params.provider,
      },
    });
    if (already) return already;

    return db.sellerLedgerEntry.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        orderId: params.orderId,
        disputeId: params.disputeId,
        amount: pending.amount,
        provider: params.provider,
        type: "PENDING_CANCELLED",
        metadata: { source: "buyer_wins_refund" },
      },
    });
  }

  async writeDisputeRefundDebit(params: {
    userId: string;
    orderId: string;
    disputeId: string;
    amount: number; // positive magnitude; stored negative
    provider: EarningProvider;
    tx: Prisma.TransactionClient;
  }) {
    const existing = await params.tx.sellerLedgerEntry.findFirst({
      where: {
        disputeId: params.disputeId,
        type: "DISPUTE_REFUND_DEBIT",
        provider: params.provider,
      },
    });
    if (existing) return existing;

    return params.tx.sellerLedgerEntry.create({
      data: {
        id: uuidv4(),
        userId: params.userId,
        orderId: params.orderId,
        disputeId: params.disputeId,
        amount: new Decimal(-Math.abs(params.amount)),
        provider: params.provider,
        type: "DISPUTE_REFUND_DEBIT",
        metadata: { source: "buyer_wins" },
      },
    });
  }

  /** Best-effort cache update after settlement; must not be inside settlement txn as business prerequisite. */
  async refreshEarningCache(userId: string, provider: EarningProvider) {
    try {
      const debits = await this.sumLedger(
        userId,
        provider,
        "DISPUTE_REFUND_DEBIT",
      );
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { earningPaypal: true, earningChapa: true, earning: true },
      });
      if (!user) return;

      // Apply ledger debits on top of current cache baseline once.
      // Track applied debit total in a synthetic way: set cache = (cache - existingDebitEffect) + debits
      // Simpler: subtract only newly applicable — we store absolute earning and recompute as
      // originalCreditsApprox = currentCache - previouslyAppliedDeBits. Use metadata flag.
      // Pragmatic v1: set earning* := earning* + delta where delta = latest debit sum - prior applied.
      const field =
        provider === "paypal" ? "earningPaypal" : ("earningChapa" as const);
      const current = Number(user[field] || 0);
      // Find sum of debits already "applied" via comparing — we recompute available separately;
      // for cache, lower by abs(debit) once using idempotent sync:
      const appliedMarker = await this.prisma.sellerLedgerEntry.findMany({
        where: {
          userId,
          provider,
          type: "DISPUTE_REFUND_DEBIT",
        },
        select: { amount: true, metadata: true },
      });
      let alreadySynced = 0;
      let totalDebit = 0;
      for (const e of appliedMarker) {
        totalDebit += Number(e.amount);
        if ((e.metadata as any)?.cacheSynced) {
          alreadySynced += Number(e.amount);
        }
      }
      const unsynced = totalDebit - alreadySynced; // negative or zero
      if (unsynced === 0) return;

      const next = current + unsynced;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          [field]: new Decimal(next),
          earning: new Decimal(
            Number(user.earning) +
              (provider === "paypal"
                ? unsynced
                : provider === "chapa"
                  ? unsynced
                  : 0),
          ),
        },
      });

      await this.prisma.sellerLedgerEntry.updateMany({
        where: {
          userId,
          provider,
          type: "DISPUTE_REFUND_DEBIT",
        },
        data: {
          metadata: { source: "buyer_wins", cacheSynced: true },
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to refresh earning cache for ${userId}: ${err?.message}`,
      );
    }
  }
}
