import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ChapaService } from './chapa.service';
import { PaypalService } from './paypal.service';
import { InitializePaymentDto, PaymentProvider } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from './interfaces/payment-response.interface';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly chapaService: ChapaService,
    private readonly paypalService: PaypalService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Initialize a payment based on the provider
   */
  async initializePayment(
    paymentData: InitializePaymentDto,
  ): Promise<PaymentInitializeResponse> {
    try {
      switch (paymentData.provider) {
        case PaymentProvider.CHAPA:
          return await this.chapaService.initializePayment(paymentData);

        case PaymentProvider.PAYPAL:
          return await this.paypalService.initializePayment(paymentData);

        default:
          throw new BadRequestException(
            `Unsupported payment provider: ${paymentData.provider}`,
          );
      }
    } catch (error) {
      this.logger.error('Payment initialization failed:', error);
      throw error;
    }
  }

  /**
   * Verify a payment based on the provider
   */
  async verifyPayment(
    verifyData: VerifyPaymentDto,
  ): Promise<PaymentVerifyResponse> {
    try {
      let verifyResponse: PaymentVerifyResponse;

      switch (verifyData.provider) {
        case PaymentProvider.CHAPA:
          verifyResponse = await this.chapaService.verifyPayment(verifyData.txRef);
          break;

        case PaymentProvider.PAYPAL:
          verifyResponse = await this.paypalService.verifyPayment(verifyData.txRef);
          break;

        default:
          throw new BadRequestException(
            `Unsupported payment provider: ${verifyData.provider}`,
          );
      }

      // If payment successful, update order status
      if (verifyResponse.success && verifyResponse.data.status === 'success') {
        // Extract orderId from txRef (format: TX-{orderId}-{timestamp})
        const txRefParts = verifyData.txRef.split('-');
        if (txRefParts.length >= 2) {
          const orderId = txRefParts[1];

          try {
            // Update order status to PAID
            await this.prisma.order.update({
              where: { id: orderId },
              data: {
                status: 'PAID',
                transaction: {
                  update: {
                    status: 'COMPLETED',
                    metadata: {
                      txRef: verifyData.txRef,
                      paymentProvider: verifyData.provider,
                      verifiedAt: new Date().toISOString(),
                    },
                  },
                },
              },
            });

            // Mark artworks as SOLD
            const order = await this.prisma.order.findUnique({
              where: { id: orderId },
              include: { items: true },
            });

            if (order) {
              const artworkIds = order.items.map(item => item.artworkId);
              await this.prisma.artwork.updateMany({
                where: { id: { in: artworkIds } },
                data: { status: 'SOLD' },
              });

              // Clear user's cart (if user is identified)
              // This can be enhanced later with proper user session
              this.logger.log(`Order ${orderId} completed and artworks marked as SOLD`);
            }
          } catch (orderError) {
            this.logger.error(`Failed to update order ${orderId}:`, orderError);
            // Don't throw error here, payment was successful
          }
        }
      }

      return verifyResponse;
    } catch (error) {
      this.logger.error('Payment verification failed:', error);
      throw error;
    }
  }

  /**
   * Handle Chapa webhook
   */
  async handleChapaWebhook(payload: any): Promise<any> {
    return this.chapaService.handleWebhook(payload);
  }

  /**
   * Handle PayPal webhook
   */
  async handlePaypalWebhook(payload: any): Promise<any> {
    return this.paypalService.handleWebhook(payload);
  }

  /**
   * Capture PayPal payment
   */
  async capturePaypalPayment(orderId: string): Promise<any> {
    return this.paypalService.capturePayment(orderId);
  }
}
