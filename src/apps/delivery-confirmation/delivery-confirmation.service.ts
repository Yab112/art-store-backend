import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { S3Service } from '../../libraries/s3/s3.service';
import { BalanceService, EarningProvider } from '../balance/balance.service';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { isFedExServiceType } from '../../libraries/currency/currency.util';

@Injectable()
export class DeliveryConfirmationService {
  private readonly logger = new Logger(DeliveryConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly balanceService: BalanceService,
  ) {}

  private parseBase64File(base64Str: string): { buffer: Buffer; contentType: string; extension: string } {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException('Invalid file format. Must be a valid base64 data URL.');
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    let extension = '.png';
    if (contentType === 'application/pdf') {
      extension = '.pdf';
    } else if (contentType === 'image/jpeg') {
      extension = '.jpg';
    } else if (contentType === 'image/png') {
      extension = '.png';
    }
    return { buffer, contentType, extension };
  }

  /** Local / non-FedEx logistics — no carrier DELIVERED event; buyer may confirm while PAID. */
  private isLocalLogisticsOrder(order: {
    status: string;
    transaction?: { metadata?: unknown } | null;
  }): boolean {
    if (order.status !== 'PAID' && order.status !== 'DISPUTED') {
      return false;
    }
    const meta = (order.transaction?.metadata as any) || {};
    const shipping = meta.shippingOption;
    if (!shipping) {
      // No shipping option recorded — treat as local if no FedEx shipments exist
      return true;
    }
    const serviceType = String(shipping.serviceType || '').trim().toUpperCase();
    if (serviceType === 'LOCAL_DELIVERY') return true;
    return !isFedExServiceType(shipping);
  }

  async confirmDelivery(buyerId: string, confirmDto: ConfirmDeliveryDto) {
    const { orderId, signatureDataUrl, acceptedTerms, hasDispute, disputeReason, disputeNote, attachmentDataUrl } = confirmDto;

    // 1. Fetch order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipments: true,
        items: {
          include: {
            artwork: true,
          },
        },
        transaction: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 2. Authorization check (only the buyer of this order can confirm delivery)
    if (order.userId !== buyerId) {
      throw new ForbiddenException('You are not authorized to confirm delivery for this order');
    }

    // 3. Eligibility: FedEx DELIVERED, or local logistics while PAID
    const fedExDelivered = order.shipments.find((s) => s.status === 'DELIVERED');
    const localLogistics = this.isLocalLogisticsOrder(order);

    if (!fedExDelivered && !localLogistics) {
      throw new BadRequestException(
        'Delivery confirmation is not available yet. For FedEx orders, wait until the shipment is marked DELIVERED.',
      );
    }

    if (order.status !== 'PAID' && order.status !== 'DISPUTED') {
      throw new BadRequestException(
        `Delivery confirmation is not available for orders in status ${order.status}.`,
      );
    }

    // 4. Idempotency: verify no confirmation exists already
    const existing = await this.prisma.deliveryConfirmation.findUnique({
      where: { orderId },
    });
    if (existing) {
      throw new BadRequestException('Delivery confirmation has already been submitted for this order.');
    }

    // 5. Upload signature to S3 (required for clean confirm; skipped for disputes)
    let signatureUrl = '';
    if (!hasDispute) {
      if (!signatureDataUrl) {
        throw new BadRequestException('Signature is required to confirm delivery.');
      }
      const sigFile = this.parseBase64File(signatureDataUrl);
      const sigUpload = await this.s3Service.uploadBuffer(
        sigFile.buffer,
        `signature-${orderId}${sigFile.extension}`,
        sigFile.contentType
      );
      signatureUrl = sigUpload.publicUrl;
    }

    // 6. Upload optional attachment (if dispute)
    let attachmentUrl: string | undefined;
    if (hasDispute && attachmentDataUrl) {
      try {
        const attFile = this.parseBase64File(attachmentDataUrl);
        const attUpload = await this.s3Service.uploadBuffer(
          attFile.buffer,
          `dispute-attachment-${orderId}${attFile.extension}`,
          attFile.contentType
        );
        attachmentUrl = attUpload.publicUrl;
      } catch (err: any) {
        this.logger.warn(`Failed to upload dispute attachment: ${err?.message}`);
      }
    }

    // 7. DB updates in a transaction
    return await this.prisma.$transaction(async (tx) => {
      // Create DeliveryConfirmation record
      const confirmation = await tx.deliveryConfirmation.create({
        data: {
          orderId,
          buyerId,
          signatureUrl: signatureUrl || 'DISPUTE_NO_SIGNATURE',
          acceptedTerms,
          hasDispute,
          disputeReason: hasDispute ? (disputeReason || 'OTHER') : null,
          disputeNote: hasDispute ? disputeNote : null,
        },
      });

      if (hasDispute) {
        this.logger.log(`Dispute raised for order ${orderId}. Marking artwork(s) as DISPUTED.`);

        await tx.order.update({
          where: { id: orderId },
          data: { status: 'DISPUTED' },
        });

        const artworkIds = order.items.map((item) => item.artworkId);
        await tx.artwork.updateMany({
          where: { id: { in: artworkIds } },
          data: { status: 'DISPUTED' },
        });

        const mainItem = order.items[0];
        if (mainItem && mainItem.artwork) {
          const disputeId = uuidv4();
          const meta = (order.transaction?.metadata as any) || {};
          const provider: EarningProvider = String(
            meta.paymentProvider || meta.provider || 'paypal',
          )
            .toLowerCase()
            .includes('chapa')
            ? 'chapa'
            : 'paypal';

          const subtotal = Number(meta.subtotal);
          const fee = Number(meta.platformFee);
          let reservedAmount =
            !Number.isNaN(subtotal) && !Number.isNaN(fee)
              ? Math.max(0, subtotal - fee)
              : 0;
          if (!reservedAmount) {
            const shipping = Number(meta.shippingCost) || 0;
            const rate = Number(meta.platformCommissionRate) || 0.12;
            const art = Math.max(0, Number(order.totalAmount) - shipping);
            reservedAmount = Math.max(0, art - art * rate);
          }

          await tx.dispute.create({
            data: {
              id: disputeId,
              orderId,
              artworkId: mainItem.artworkId,
              targetUserId: mainItem.artwork.userId,
              raisedById: buyerId,
              reason: disputeReason || 'OTHER',
              description: disputeNote || 'No description provided.',
              attachmentUrl: attachmentUrl || null,
              status: 'IN_PROGRESS',
              reservedAmount: new Decimal(reservedAmount),
              reservedProvider: provider,
              updatedAt: new Date(),
            },
          });
        }

        if (order.transaction) {
          const metadata = (order.transaction.metadata as any) || {};
          await tx.transaction.update({
            where: { id: order.transaction.id },
            data: {
              metadata: {
                ...metadata,
                frozen: true,
                freezeReason: 'DISPUTE_RAISED',
                frozenAt: new Date().toISOString(),
              },
            },
          });
        }
      } else {
        this.logger.log(`Delivery confirmed cleanly for order ${orderId}. Marking order as COMPLETED.`);

        await tx.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED' },
        });

        // Phase 2: release pending credits for each artist on the order
        const meta = (order.transaction?.metadata as any) || {};
        const provider: EarningProvider = String(
          meta.paymentProvider || meta.provider || 'paypal',
        )
          .toLowerCase()
          .includes('chapa')
          ? 'chapa'
          : 'paypal';

        const artistIds = [
          ...new Set(
            order.items
              .map((i) => i.artwork?.userId)
              .filter(Boolean) as string[],
          ),
        ];
        for (const artistId of artistIds) {
          await this.balanceService.releasePendingCredit({
            userId: artistId,
            orderId,
            provider,
            tx,
          });
        }
      }

      return confirmation;
    });
  }

  async getConfirmation(buyerId: string, orderId: string) {
    const confirmation = await this.prisma.deliveryConfirmation.findUnique({
      where: { orderId },
    });

    if (confirmation && confirmation.buyerId !== buyerId) {
      throw new ForbiddenException('Access denied');
    }

    return confirmation;
  }
}
