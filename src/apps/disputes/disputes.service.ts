import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { BalanceService, EarningProvider } from "../balance/balance.service";
import { RefundGatewayService } from "../payment/refund-gateway.service";
import { S3Service } from "../../libraries/s3/s3.service";
import { EmailService } from "../../libraries/email";
import { ConfigurationService } from "../../core/configuration";
import {
  ResolveDisputeDto,
  ConfirmReturnDto,
} from "./dto/resolve-dispute.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  formatMoney,
  normalizeCurrency,
} from "../../libraries/currency/currency.util";

/** Dispute statuses that still reserve seller funds / block buyer orders */
export const ACTIVE_DISPUTE_STATUSES = [
  "IN_PROGRESS",
  "WAITING_FOR_RETURN",
  "READY_FOR_REFUND",
] as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly refundGateway: RefundGatewayService,
    private readonly s3Service: S3Service,
    private readonly emailService: EmailService,
    private readonly configurationService: ConfigurationService,
  ) {}

  async listDisputes(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { id: { contains: s, mode: "insensitive" } },
        { orderId: { contains: s, mode: "insensitive" } },
        { reason: { contains: s, mode: "insensitive" } },
        {
          User_Dispute_raisedByIdToUser: {
            email: { contains: s, mode: "insensitive" },
          },
        },
        {
          targetUser: {
            email: { contains: s, mode: "insensitive" },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              totalAmount: true,
              status: true,
              buyerEmail: true,
            },
          },
          artwork: {
            select: { id: true, title: true, photos: true, status: true },
          },
          User_Dispute_raisedByIdToUser: {
            select: { id: true, name: true, email: true },
          },
          targetUser: {
            select: { id: true, name: true, email: true },
          },
          refund: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: items.map((d) => this.withDerived(d)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /** Seller: disputes against them awaiting return confirmation */
  async listSellerReturnQueue(sellerId: string) {
    const items = await this.prisma.dispute.findMany({
      where: {
        targetUserId: sellerId,
        status: "WAITING_FOR_RETURN",
      },
      include: {
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            buyerEmail: true,
          },
        },
        artwork: {
          select: { id: true, title: true, photos: true, status: true },
        },
        User_Dispute_raisedByIdToUser: {
          select: { id: true, name: true, email: true },
        },
        refund: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return { disputes: items.map((d) => this.withDerived(d)) };
  }

  async getDisputeById(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                artwork: {
                  select: {
                    id: true,
                    title: true,
                    photos: true,
                    status: true,
                    userId: true,
                  },
                },
              },
            },
            transaction: true,
            deliveryConfirmation: true,
            shipments: {
              include: {
                events: { orderBy: { timestamp: "desc" }, take: 10 },
              },
            },
            platformEarning: true,
          },
        },
        artwork: true,
        User_Dispute_raisedByIdToUser: {
          select: { id: true, name: true, email: true, image: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, image: true },
        },
        refund: true,
        resolutionEvents: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    return this.withDerived(dispute);
  }

  async getSellerDispute(disputeId: string, sellerId: string) {
    const dispute = await this.getDisputeById(disputeId);
    if (dispute.targetUserId !== sellerId) {
      throw new ForbiddenException("Not your dispute");
    }
    return dispute;
  }

  async resolveDispute(
    disputeId: string,
    adminUserId: string,
    dto: ResolveDisputeDto,
  ) {
    const dispute = await this.loadDisputeForAdmin(disputeId);

    if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
      throw new BadRequestException(
        "RESOLVED disputes are immutable. Use a separate manual process for later corrections.",
      );
    }

    if (!dispute.orderId || !dispute.order) {
      throw new BadRequestException(
        "Dispute is missing order link; cannot resolve.",
      );
    }

    if (dto.outcome === "SELLER_WINS") {
      if (dispute.status !== "IN_PROGRESS") {
        throw new BadRequestException(
          "Seller Wins is only allowed while the dispute is IN_PROGRESS. Cancel Buyer Wins first if needed.",
        );
      }
      return this.resolveSellerWins(dispute, adminUserId, dto.resolution);
    }

    // BUYER_WINS — record decision only (no gateway)
    if (dispute.status !== "IN_PROGRESS") {
      throw new BadRequestException(
        "Buyer Wins can only be recorded from IN_PROGRESS.",
      );
    }
    return this.recordBuyerWins(dispute, adminUserId, dto);
  }

  async waiveReturn(disputeId: string, adminUserId: string, reason: string) {
    const dispute = await this.loadDisputeForAdmin(disputeId);
    if (dispute.status !== "WAITING_FOR_RETURN") {
      throw new BadRequestException(
        "Return can only be waived while WAITING_FOR_RETURN.",
      );
    }
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException("Waive reason is required.");
    }

    const previousStatus = dispute.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "READY_FOR_REFUND",
          returnRequired: false,
          returnWaivedAt: new Date(),
          returnWaivedById: adminUserId,
          returnWaiveReason: trimmed,
          updatedAt: new Date(),
        },
      });
      await this.writeEvent(tx, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus,
        newStatus: "READY_FOR_REFUND",
        outcome: "BUYER_WINS",
        eventType: "RETURN_WAIVED",
        resolutionNote: trimmed,
      });
    });

    const updated = await this.getDisputeById(dispute.id);
    void this.notifyReturnWaived(updated);
    return {
      success: true,
      dispute: updated,
    };
  }

  async cancelBuyerWins(
    disputeId: string,
    adminUserId: string,
    reason?: string,
  ) {
    const dispute = await this.loadDisputeForAdmin(disputeId);

    if (
      dispute.status !== "WAITING_FOR_RETURN" &&
      dispute.status !== "READY_FOR_REFUND"
    ) {
      throw new BadRequestException(
        "Cancel Buyer Wins is only allowed from WAITING_FOR_RETURN or READY_FOR_REFUND.",
      );
    }

    const refund = dispute.refund;
    if (!refund) {
      throw new BadRequestException("No pending refund found for this dispute.");
    }
    if (refund.status !== "PENDING") {
      throw new BadRequestException(
        `Cannot cancel Buyer Wins while refund is ${refund.status}. Only PENDING refunds can be cancelled.`,
      );
    }

    const previousStatus = dispute.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "CANCELLED",
          failureReason: reason?.trim() || "Buyer Wins cancelled by admin",
        },
      });

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "IN_PROGRESS",
          outcome: null,
          resolution: null,
          assignedToId: null,
          returnRequired: null,
          returnWaivedAt: null,
          returnWaivedById: null,
          returnWaiveReason: null,
          returnConfirmedAt: null,
          returnConfirmedBySellerId: null,
          returnConfirmNote: null,
          returnConfirmPhotoUrls: [],
          returnSignatureUrl: null,
          updatedAt: new Date(),
        },
      });

      // Detach cancelled refund so a fresh PENDING row can be created later
      await tx.refund.update({
        where: { id: refund.id },
        data: { disputeId: null },
      });

      await this.writeEvent(tx, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus,
        newStatus: "IN_PROGRESS",
        outcome: null,
        eventType: "BUYER_WINS_CANCELLED",
        resolutionNote: reason?.trim() || "Buyer Wins cancelled",
        metadata: { cancelledRefundId: refund.id },
      });
    });

    return {
      success: true,
      dispute: await this.getDisputeById(dispute.id),
    };
  }

  async confirmReturn(
    disputeId: string,
    sellerId: string,
    dto: ConfirmReturnDto,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { refund: true },
    });
    if (!dispute) throw new NotFoundException("Dispute not found");
    if (dispute.targetUserId !== sellerId) {
      throw new ForbiddenException("Only the disputed seller can confirm return");
    }

    // Idempotent: already confirmed
    if (
      dispute.status === "READY_FOR_REFUND" &&
      dispute.returnConfirmedAt
    ) {
      return {
        success: true,
        alreadyConfirmed: true,
        dispute: await this.getDisputeById(dispute.id),
      };
    }

    if (dispute.status !== "WAITING_FOR_RETURN") {
      throw new BadRequestException(
        "Return can only be confirmed while WAITING_FOR_RETURN.",
      );
    }

    if (!dto.signatureDataUrl?.trim()) {
      throw new BadRequestException(
        "Signature is required to confirm you received the returned artwork.",
      );
    }

    const sigFile = this.parseBase64File(dto.signatureDataUrl);
    const sigUpload = await this.s3Service.uploadBuffer(
      sigFile.buffer,
      `return-signature-${disputeId}${sigFile.extension}`,
      sigFile.contentType,
    );

    const photoUrls: string[] = [];
    for (const [i, dataUrl] of (dto.photoDataUrls || []).slice(0, 5).entries()) {
      if (!dataUrl?.trim()) continue;
      try {
        const file = this.parseBase64File(dataUrl);
        const up = await this.s3Service.uploadBuffer(
          file.buffer,
          `return-photo-${disputeId}-${i}${file.extension}`,
          file.contentType,
        );
        photoUrls.push(up.publicUrl);
      } catch (err: any) {
        this.logger.warn(`Return photo upload failed: ${err?.message}`);
      }
    }

    const previousStatus = dispute.status;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "READY_FOR_REFUND",
          returnConfirmedAt: now,
          returnConfirmedBySellerId: sellerId,
          returnConfirmNote: dto.note?.trim() || null,
          returnConfirmPhotoUrls: photoUrls,
          returnSignatureUrl: sigUpload.publicUrl,
          updatedAt: now,
        },
      });

      // Keep Refund.sellerSigned in sync for ops dashboards that still read it
      if (dispute.refund) {
        await tx.refund.update({
          where: { id: dispute.refund.id },
          data: {
            sellerSigned: true,
            signatureUrl: sigUpload.publicUrl,
          },
        });
      }

      await this.writeEvent(tx, {
        disputeId: dispute.id,
        adminUserId: null,
        previousStatus,
        newStatus: "READY_FOR_REFUND",
        outcome: "BUYER_WINS",
        eventType: "RETURN_CONFIRMED",
        resolutionNote:
          "Seller confirmed receipt of returned artwork (receipt only — not condition).",
        metadata: {
          sellerId,
          note: dto.note?.trim() || null,
          photoCount: photoUrls.length,
        },
      });
    });

    const updated = await this.getDisputeById(dispute.id);
    void this.notifyReturnConfirmed(updated);
    return {
      success: true,
      dispute: updated,
    };
  }

  /**
   * Sole financial action for Buyer Wins.
   * Also supports legacy IN_PROGRESS + PROCESSING/FAILED refund reconcile.
   */
  async completeRefund(
    disputeId: string,
    adminUserId: string,
    note?: string,
  ) {
    const dispute = await this.loadDisputeForAdmin(disputeId);

    if (dispute.status === "RESOLVED" || dispute.refund?.status === "COMPLETED") {
      return {
        success: true,
        alreadyResolved: true,
        dispute: await this.getDisputeById(dispute.id),
      };
    }

    const isReady = dispute.status === "READY_FOR_REFUND";
    const isLegacyReconcile =
      !!dispute.refund &&
      ["PROCESSING", "FAILED"].includes(dispute.refund.status) &&
      (dispute.outcome === "BUYER_WINS" ||
        dispute.status === "IN_PROGRESS");

    if (!isReady && !isLegacyReconcile) {
      throw new BadRequestException(
        "Complete Refund requires READY_FOR_REFUND (return confirmed or waived).",
      );
    }

    if (isReady) {
      const confirmed = !!dispute.returnConfirmedAt;
      const waived = !!dispute.returnWaivedAt;
      if (!confirmed && !waived) {
        throw new BadRequestException(
          "Cannot Complete Refund until return is confirmed or waived.",
        );
      }
    }

    if (!dispute.orderId || !dispute.order) {
      throw new BadRequestException("Dispute is missing order link.");
    }

    return this.executeBuyerWinsRefund(
      dispute,
      adminUserId,
      note || dispute.resolution || "Complete refund",
    );
  }

  // ─── private: Seller Wins ───────────────────────────────────────────

  private async resolveSellerWins(
    dispute: any,
    adminUserId: string,
    resolution: string,
  ) {
    const previousStatus = dispute.status;
    const order = dispute.order;
    const provider = this.resolveProvider(order.transaction?.metadata);

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED",
          outcome: "SELLER_WINS",
          resolution,
          assignedToId: adminUserId,
          resolvedAt: new Date(),
          reservedAmount: null,
          updatedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });

      const artworkIds = order.items.map((i: any) => i.artworkId);
      await tx.artwork.updateMany({
        where: { id: { in: artworkIds }, status: "DISPUTED" },
        data: { status: "SOLD" },
      });

      if (order.transaction) {
        const metadata = (order.transaction.metadata as any) || {};
        const { frozen, freezeReason, frozenAt, ...rest } = metadata;
        await tx.transaction.update({
          where: { id: order.transaction.id },
          data: {
            metadata: {
              ...rest,
              disputeResolvedAt: new Date().toISOString(),
              disputeOutcome: "SELLER_WINS",
            },
          },
        });
      }

      await this.writeEvent(tx, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus,
        newStatus: "RESOLVED",
        outcome: "SELLER_WINS",
        eventType: "SELLER_WINS",
        resolutionNote: resolution,
      });

      if (dispute.targetUserId) {
        await this.balanceService.releasePendingCredit({
          userId: dispute.targetUserId,
          orderId: order.id,
          provider,
          tx,
        });
      }
    });

    return {
      success: true,
      dispute: await this.getDisputeById(dispute.id),
    };
  }

  // ─── private: Record Buyer Wins (no money) ──────────────────────────

  private async recordBuyerWins(
    dispute: any,
    adminUserId: string,
    dto: ResolveDisputeDto,
  ) {
    const order = dispute.order;
    const metadata = (order.transaction?.metadata as any) || {};
    const provider = this.resolveProvider(metadata);
    const { chargedAmount: refundAmount, currency } =
      this.requireChargeSnapshot(metadata, order);
    const idempotencyKey = `dispute:${dispute.id}:buyer-wins`;

    const returnRequired = dto.returnRequired !== false;
    const waiveReason = dto.returnWaiveReason?.trim();

    if (!returnRequired && !waiveReason) {
      throw new BadRequestException(
        "returnWaiveReason is required when return is not required.",
      );
    }

    if (dispute.refund && dispute.refund.status !== "CANCELLED") {
      throw new BadRequestException(
        `Dispute already has a refund in status ${dispute.refund.status}.`,
      );
    }

    // If a prior cancelled refund still occupies orderId unique, we need a new row —
    // orderId is @unique on Refund. Cleared disputeId on cancel but orderId remains.
    // So cancel must also allow re-create: delete cancelled or reuse by updating.
    let existingCancelled = await this.prisma.refund.findUnique({
      where: { orderId: order.id },
    });

    const previousStatus = dispute.status;
    const nextStatus = returnRequired ? "WAITING_FOR_RETURN" : "READY_FOR_REFUND";
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: nextStatus as any,
          outcome: "BUYER_WINS",
          resolution: dto.resolution.trim(),
          assignedToId: adminUserId,
          returnRequired,
          returnWaivedAt: returnRequired ? null : now,
          returnWaivedById: returnRequired ? null : adminUserId,
          returnWaiveReason: returnRequired ? null : waiveReason,
          returnConfirmedAt: null,
          returnConfirmedBySellerId: null,
          returnConfirmNote: null,
          returnConfirmPhotoUrls: [],
          returnSignatureUrl: null,
          updatedAt: now,
        },
      });

      if (existingCancelled) {
        await tx.refund.update({
          where: { id: existingCancelled.id },
          data: {
            disputeId: dispute.id,
            amount: new Decimal(refundAmount),
            status: "PENDING",
            sellerSigned: false,
            signatureUrl: null,
            gatewayRefundId: null,
            idempotencyKey,
            failureReason: null,
            provider,
          },
        });
      } else {
        await tx.refund.create({
          data: {
            orderId: order.id,
            disputeId: dispute.id,
            amount: new Decimal(refundAmount),
            status: "PENDING",
            idempotencyKey,
            provider,
          },
        });
      }

      await this.writeEvent(tx, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus,
        newStatus: nextStatus,
        outcome: "BUYER_WINS",
        eventType: "BUYER_WINS_RECORDED",
        resolutionNote: dto.resolution.trim(),
        metadata: {
          returnRequired,
          currency,
          chargedAmount: refundAmount,
        },
      });

      if (!returnRequired) {
        await this.writeEvent(tx, {
          disputeId: dispute.id,
          adminUserId,
          previousStatus: nextStatus,
          newStatus: nextStatus,
          outcome: "BUYER_WINS",
          eventType: "RETURN_WAIVED",
          resolutionNote: waiveReason,
        });
      }
    });

    const updated = await this.getDisputeById(dispute.id);
    void this.notifyBuyerWinsRecorded(updated, returnRequired);
    return {
      success: true,
      dispute: updated,
    };
  }

  // ─── private: Gateway refund + settlement ───────────────────────────

  private async executeBuyerWinsRefund(
    dispute: any,
    adminUserId: string,
    resolution: string,
  ) {
    const order = dispute.order;
    const metadata = (order.transaction?.metadata as any) || {};
    const provider = this.resolveProvider(metadata);
    const idempotencyKey =
      dispute.refund?.idempotencyKey || `dispute:${dispute.id}:buyer-wins`;
    const { chargedAmount: refundAmount, currency } =
      this.requireChargeSnapshot(metadata, order);
    const sellerNet =
      Number(dispute.reservedAmount) || this.estimateSellerNet(order);

    let refund = dispute.refund;
    if (!refund) {
      refund = await this.prisma.refund.create({
        data: {
          orderId: order.id,
          disputeId: dispute.id,
          amount: new Decimal(refundAmount),
          status: "PROCESSING",
          idempotencyKey,
          provider,
        },
      });
    } else if (refund.status !== "PROCESSING") {
      refund = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSING",
          failureReason: null,
          idempotencyKey: refund.idempotencyKey || idempotencyKey,
          provider,
          amount: new Decimal(refundAmount),
        },
      });
    } else {
      refund = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          failureReason: `Reconcile retry started at ${new Date().toISOString()}`,
        },
      });
    }

    let gatewayResult: Awaited<
      ReturnType<typeof this.refundGateway.refundOrderPayment>
    >;
    try {
      gatewayResult = await this.refundGateway.refundOrderPayment({
        provider,
        amount: refundAmount,
        currency,
        idempotencyKey: refund.idempotencyKey || idempotencyKey,
        metadata,
      });
    } catch (err: any) {
      const message =
        err?.message || err?.response?.data?.message || "Unexpected gateway error";
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          failureReason: String(message).slice(0, 500),
        },
      });
      await this.writeEvent(this.prisma, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus: dispute.status,
        newStatus: dispute.status,
        outcome: "BUYER_WINS",
        eventType: "REFUND_FAILED",
        resolutionNote: String(message).slice(0, 500),
      });
      void this.notifyRefundFailed(dispute, String(message));
      throw new BadRequestException(`Gateway refund error: ${message}`);
    }

    if (gatewayResult.outcome === "unknown") {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSING",
          failureReason: gatewayResult.message || "Unknown gateway outcome",
        },
      });
      await this.writeEvent(this.prisma, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus: dispute.status,
        newStatus: dispute.status,
        outcome: "BUYER_WINS",
        eventType: "REFUND_FAILED",
        resolutionNote:
          gatewayResult.message || "Unknown gateway outcome (left PROCESSING)",
        metadata: { soft: true },
      });
      void this.notifyRefundFailed(
        dispute,
        gatewayResult.message || "Unknown gateway outcome",
      );
      throw new BadRequestException(
        `Gateway refund outcome unknown (left PROCESSING). Click Complete Refund again to reconcile. Detail: ${gatewayResult.message || "timeout"}`,
      );
    }

    if (gatewayResult.outcome === "failed") {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          failureReason: gatewayResult.message || "Gateway refund failed",
        },
      });
      await this.writeEvent(this.prisma, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus: dispute.status,
        newStatus: dispute.status,
        outcome: "BUYER_WINS",
        eventType: "REFUND_FAILED",
        resolutionNote: gatewayResult.message || "Gateway refund failed",
      });
      void this.notifyRefundFailed(
        dispute,
        gatewayResult.message || "Gateway refund failed",
      );
      throw new BadRequestException(
        `Gateway refund failed: ${gatewayResult.message || "unknown error"}`,
      );
    }

    const previousStatus = dispute.status;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          if (dispute.targetUserId) {
            await this.balanceService.writeDisputeRefundDebit({
              userId: dispute.targetUserId,
              orderId: order.id,
              disputeId: dispute.id,
              amount: sellerNet,
              provider,
              tx,
            });
            await this.balanceService.cancelPendingCredit({
              userId: dispute.targetUserId,
              orderId: order.id,
              provider,
              disputeId: dispute.id,
              tx,
            });
          }

          if (order.platformEarning) {
            const existingAdj = await tx.platformEarningAdjustment.findFirst({
              where: {
                disputeId: dispute.id,
                reason: "DISPUTE_BUYER_WINS_REFUND",
              },
            });
            if (!existingAdj) {
              await tx.platformEarningAdjustment.create({
                data: {
                  id: uuidv4(),
                  platformEarningId: order.platformEarning.id,
                  orderId: order.id,
                  disputeId: dispute.id,
                  amount: new Decimal(-Number(order.platformEarning.amount)),
                  reason: "DISPUTE_BUYER_WINS_REFUND",
                  metadata: { gatewayRefundId: gatewayResult.gatewayRefundId },
                },
              });
            }
          }

          await tx.refund.update({
            where: { id: refund.id },
            data: {
              status: "COMPLETED",
              gatewayRefundId: gatewayResult.gatewayRefundId || null,
              failureReason: null,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { status: "REFUNDED" },
          });

          const artworkIds = order.items.map((i: any) => i.artworkId);
          await tx.artwork.updateMany({
            where: { id: { in: artworkIds } },
            data: { status: "APPROVED", isApproved: true },
          });

          await tx.dispute.update({
            where: { id: dispute.id },
            data: {
              status: "RESOLVED",
              outcome: "BUYER_WINS",
              resolution,
              assignedToId: adminUserId,
              resolvedAt: new Date(),
              gatewayRefundId: gatewayResult.gatewayRefundId || null,
              reservedAmount: null,
              updatedAt: new Date(),
            },
          });

          if (order.transaction) {
            const meta = (order.transaction.metadata as any) || {};
            const { frozen, freezeReason, frozenAt, ...rest } = meta;
            await tx.transaction.update({
              where: { id: order.transaction.id },
              data: {
                metadata: {
                  ...rest,
                  disputeResolvedAt: new Date().toISOString(),
                  disputeOutcome: "BUYER_WINS",
                  gatewayRefundId: gatewayResult.gatewayRefundId,
                },
              },
            });
          }

          await this.writeEvent(tx, {
            disputeId: dispute.id,
            adminUserId,
            previousStatus,
            newStatus: "RESOLVED",
            outcome: "BUYER_WINS",
            eventType: "REFUND_COMPLETED",
            resolutionNote: resolution,
            gatewayRefundId: gatewayResult.gatewayRefundId || null,
          });
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
    } catch (err: any) {
      const message = err?.message || "Settlement failed after gateway refund";
      this.logger.error(
        `Complete refund settlement failed for dispute ${dispute.id}: ${message}`,
      );
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSING",
          gatewayRefundId: gatewayResult.gatewayRefundId || null,
          failureReason: `Settlement error (retry Complete Refund): ${String(message).slice(0, 400)}`,
        },
      });
      await this.writeEvent(this.prisma, {
        disputeId: dispute.id,
        adminUserId,
        previousStatus: dispute.status,
        newStatus: dispute.status,
        outcome: "BUYER_WINS",
        eventType: "REFUND_FAILED",
        resolutionNote: `Settlement error: ${String(message).slice(0, 400)}`,
        metadata: { gatewayRefundId: gatewayResult.gatewayRefundId },
      });
      void this.notifyRefundFailed(dispute, String(message));
      throw new BadRequestException(
        `Gateway refunded but settlement failed. Click Complete Refund again to finish. Detail: ${message}`,
      );
    }

    if (dispute.targetUserId) {
      void this.balanceService.refreshEarningCache(
        dispute.targetUserId,
        provider,
      );
    }

    const settled = await this.getDisputeById(dispute.id);
    void this.notifyRefundCompleted(settled);
    return {
      success: true,
      dispute: settled,
    };
  }

  // ─── helpers ────────────────────────────────────────────────────────

  private withDerived<T extends Record<string, any>>(dispute: T) {
    return {
      ...dispute,
      sellerConfirmed: !!dispute.returnConfirmedAt,
    };
  }

  private async loadDisputeForAdmin(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            items: { include: { artwork: true } },
            transaction: true,
            platformEarning: true,
          },
        },
        refund: true,
        artwork: true,
      },
    });
    if (!dispute) throw new NotFoundException("Dispute not found");
    return dispute;
  }

  private async writeEvent(
    db: Tx | PrismaService,
    params: {
      disputeId: string;
      adminUserId: string | null;
      previousStatus: string;
      newStatus: string;
      outcome?: string | null;
      eventType: string;
      resolutionNote?: string | null;
      gatewayRefundId?: string | null;
      metadata?: Record<string, any>;
    },
  ) {
    return db.disputeResolutionEvent.create({
      data: {
        id: uuidv4(),
        disputeId: params.disputeId,
        adminUserId: params.adminUserId,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        outcome: params.outcome ?? null,
        eventType: params.eventType,
        resolutionNote: params.resolutionNote ?? null,
        gatewayRefundId: params.gatewayRefundId ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  }

  private parseBase64File(base64Str: string): {
    buffer: Buffer;
    contentType: string;
    extension: string;
  } {
    const matches = base64Str.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException("Invalid base64 data URL");
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const extMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/webp": ".webp",
    };
    return {
      buffer,
      contentType,
      extension: extMap[contentType] || ".bin",
    };
  }

  // ─── email notifications (best-effort) ──────────────────────────────

  private frontendUrl() {
    return (
      this.configurationService.get("FRONTEND_URL") ||
      this.configurationService.get("CLIENT_BASE_URL") ||
      "http://localhost:5173"
    );
  }

  private adminFrontendUrl() {
    return (
      this.configurationService.get("ADMIN_FRONTEND_URL") ||
      "http://localhost:3001"
    );
  }

  private async sendDisputeEmail(params: {
    name: string;
    email: string;
    subject: string;
    headline: string;
    body: string;
    details?: string;
    actionUrl?: string;
    actionLabel?: string;
    footerNote?: string;
  }) {
    if (!params.email) return;
    try {
      await this.emailService.send({
        name: params.name || "there",
        email: params.email,
        subject: params.subject,
        template: "dispute-notification",
        variables: {
          recipientName: params.name || "there",
          headline: params.headline,
          body: params.body,
          details: params.details || "",
          actionUrl: params.actionUrl || "",
          actionLabel: params.actionLabel || "",
          footerNote: params.footerNote || "",
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Dispute email to ${params.email} failed: ${err?.message || err}`,
      );
    }
  }

  private async getAdminRecipients() {
    return this.prisma.user.findMany({
      where: {
        OR: [{ role: "ADMIN" }, { role: "admin" }, { role: "Admin" }],
      },
      select: { id: true, name: true, email: true },
    });
  }

  private disputeDetailsHtml(dispute: any) {
    const orderId = dispute.orderId?.slice(0, 8)?.toUpperCase() || "—";
    const title = dispute.artwork?.title || "Artwork";
    const reason = String(dispute.reason || "").replace(/_/g, " ");
    return `
      <strong>Artwork:</strong> ${title}<br>
      <strong>Order:</strong> #${orderId}<br>
      <strong>Dispute reason:</strong> ${reason}<br>
      <strong>Status:</strong> ${dispute.status}
    `;
  }

  private async notifyBuyerWinsRecorded(
    dispute: any,
    returnRequired: boolean,
  ) {
    const buyer = dispute.User_Dispute_raisedByIdToUser;
    const seller = dispute.targetUser;
    const details = this.disputeDetailsHtml(dispute);
    const ordersUrl = `${this.frontendUrl()}/orders`;
    const confirmUrl = `${this.frontendUrl()}/confirm-return/${dispute.id}`;

    if (buyer?.email) {
      await this.sendDisputeEmail({
        name: buyer.name,
        email: buyer.email,
        subject: returnRequired
          ? "Buyer Wins — please return the artwork"
          : "Buyer Wins — refund will be processed",
        headline: "Buyer Wins recorded",
        body: returnRequired
          ? "An admin upheld your dispute. Please ship the artwork back to the seller. Your refund will be completed after the seller confirms receipt and an admin authorizes the refund."
          : "An admin upheld your dispute. A return is not required in this case. An admin will complete your refund shortly.",
        details,
        actionUrl: ordersUrl,
        actionLabel: "View my orders",
      });
    }

    if (seller?.email) {
      await this.sendDisputeEmail({
        name: seller.name,
        email: seller.email,
        subject: returnRequired
          ? "Dispute: Buyer Wins — confirm return when received"
          : "Dispute: Buyer Wins — refund pending",
        headline: "Buyer Wins recorded",
        body: returnRequired
          ? "An admin decided Buyer Wins. When you receive the returned artwork, confirm receipt on the platform (receipt only — not condition). The refund will not run until an admin completes it."
          : "An admin decided Buyer Wins and waived the return requirement. A refund will be completed by an admin soon. No return confirmation is needed from you.",
        details,
        actionUrl: returnRequired
          ? confirmUrl
          : `${this.frontendUrl()}/profile?tab=shipments`,
        actionLabel: returnRequired
          ? "Confirm return receipt"
          : "View shipments",
      });
    }
  }

  private async notifyReturnConfirmed(dispute: any) {
    const details = this.disputeDetailsHtml(dispute);
    const admins = await this.getAdminRecipients();
    const adminUrl = `${this.adminFrontendUrl()}/dashboard/disputes`;
    await Promise.all(
      admins.map((admin) =>
        this.sendDisputeEmail({
          name: admin.name,
          email: admin.email,
          subject: "Seller confirmed returned artwork — ready for refund",
          headline: "Return confirmed",
          body: "The seller confirmed they received the returned artwork. The dispute is READY_FOR_REFUND. Complete the refund when ready.",
          details,
          actionUrl: adminUrl,
          actionLabel: "Open disputes",
        }),
      ),
    );
  }

  private async notifyReturnWaived(dispute: any) {
    const buyer = dispute.User_Dispute_raisedByIdToUser;
    const details = this.disputeDetailsHtml(dispute);
    if (buyer?.email) {
      await this.sendDisputeEmail({
        name: buyer.name,
        email: buyer.email,
        subject: "Return waived — refund pending admin completion",
        headline: "Return requirement waived",
        body: "An admin waived the artwork return requirement for your dispute. Your refund is ready for admin completion and has not been sent yet.",
        details,
        actionUrl: `${this.frontendUrl()}/orders`,
        actionLabel: "View my orders",
        footerNote: dispute.returnWaiveReason
          ? `Waive reason: ${dispute.returnWaiveReason}`
          : undefined,
      });
    }
  }

  private async notifyRefundCompleted(dispute: any) {
    const buyer = dispute.User_Dispute_raisedByIdToUser;
    const seller = dispute.targetUser;
    const details = this.disputeDetailsHtml(dispute);
    const metaCurrency = normalizeCurrency(
      dispute.order?.transaction?.metadata?.currency,
    );
    const amount = dispute.refund?.amount
      ? formatMoney(dispute.refund.amount, metaCurrency)
      : "the order total";

    if (buyer?.email) {
      await this.sendDisputeEmail({
        name: buyer.name,
        email: buyer.email,
        subject: "Refund completed",
        headline: "Your refund is complete",
        body: `Your dispute refund of ${amount} has been processed. Funds should appear according to your payment provider's timeline.`,
        details,
        actionUrl: `${this.frontendUrl()}/orders`,
        actionLabel: "View my orders",
      });
    }

    if (seller?.email) {
      await this.sendDisputeEmail({
        name: seller.name,
        email: seller.email,
        subject: "Dispute refund completed",
        headline: "Buyer Wins refund completed",
        body: "The buyer refund for this dispute has been completed. Related earnings adjustments have been applied.",
        details,
        actionUrl: `${this.frontendUrl()}/profile?tab=shipments`,
        actionLabel: "View shipments",
      });
    }
  }

  private async notifyRefundFailed(dispute: any, reason: string) {
    const details = `${this.disputeDetailsHtml(dispute)}<br><strong>Error:</strong> ${reason}`;
    const admins = await this.getAdminRecipients();
    const adminUrl = `${this.adminFrontendUrl()}/dashboard/disputes`;
    await Promise.all(
      admins.map((admin) =>
        this.sendDisputeEmail({
          name: admin.name,
          email: admin.email,
          subject: "Dispute refund failed — action needed",
          headline: "Refund failed",
          body: "Complete Refund failed or could not be confirmed. Retry Complete Refund from the admin disputes panel.",
          details,
          actionUrl: adminUrl,
          actionLabel: "Open disputes",
        }),
      ),
    );
  }

  private requireChargeSnapshot(
    metadata: Record<string, any>,
    order: { totalAmount?: any; id?: string },
  ): { chargedAmount: number; currency: string } {
    const currency = normalizeCurrency(metadata?.currency);
    const chargedAmount = Number(metadata?.chargedAmount);
    if (currency && Number.isFinite(chargedAmount) && chargedAmount > 0) {
      return { chargedAmount, currency };
    }

    // Fail closed — do not invent currency from payment provider at refund time.
    throw new BadRequestException(
      `Payment record for order ${order?.id || "unknown"} is missing currency/chargedAmount. Run the currency backfill migration or set them manually before refunding.`,
    );
  }

  private resolveProvider(metadata: any): EarningProvider {
    const p = String(
      metadata?.paymentProvider || metadata?.provider || "paypal",
    ).toLowerCase();
    return p.includes("chapa") ? "chapa" : "paypal";
  }

  private estimateSellerNet(order: any): number {
    const meta = (order.transaction?.metadata as any) || {};
    const subtotal = Number(meta.subtotal);
    const fee = Number(meta.platformFee);
    if (!Number.isNaN(subtotal) && !Number.isNaN(fee)) {
      return Math.max(0, subtotal - fee);
    }
    const total = Number(order.totalAmount) || 0;
    const shipping = Number(meta.shippingCost) || 0;
    const rate = Number(meta.platformCommissionRate) || 0.12;
    const art = Math.max(0, total - shipping);
    return Math.max(0, art - art * rate);
  }
}
