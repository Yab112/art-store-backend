import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ChapaService } from "./chapa.service";
import { PaypalService } from "./paypal.service";
import {
  InitializePaymentDto,
  PaymentProvider,
} from "./dto/initialize-payment.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import {
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from "./interfaces/payment-response.interface";
import { PrismaService } from "../../core/database/prisma.service";
import { OrderService } from "../order/order.service";
import { CartService } from "../cart/cart.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { PaymentStatus } from "@prisma/client";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly chapaService: ChapaService,
    private readonly paypalService: PaypalService,
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    @Inject(forwardRef(() => WithdrawalsService))
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  /**
   * Initialize a payment based on the provider
   */
  async initializePayment(
    paymentData: InitializePaymentDto,
  ): Promise<PaymentInitializeResponse> {
    try {
      let initializeResponse: PaymentInitializeResponse;
      switch (paymentData.provider) {
        case PaymentProvider.CHAPA:
          initializeResponse =
            await this.chapaService.initializePayment(paymentData);
          // If Chapa returned a shortened txRef, store it in transaction metadata
          if (
            paymentData.orderId &&
            (initializeResponse.data as any).chapaTxRef
          ) {
            try {
              const order = await this.prisma.order.findUnique({
                where: { id: paymentData.orderId },
                include: { transaction: true },
              });
              if (order?.transaction) {
                const metadata = (order.transaction.metadata as any) || {};
                await this.prisma.transaction.update({
                  where: { id: order.transaction.id },
                  data: {
                    metadata: {
                      ...metadata,
                      chapaTxRef: (initializeResponse.data as any).chapaTxRef,
                      originalTxRef: paymentData.txRef,
                    },
                  },
                });
                this.logger.log(
                  `Stored Chapa txRef mapping for order ${paymentData.orderId}`,
                );
              }
            } catch (error) {
              // Log but don't fail - this is just for optimization
              this.logger.warn(`Failed to store Chapa txRef mapping: ${error}`);
            }
          }
          return initializeResponse;

        case PaymentProvider.PAYPAL:
          return await this.paypalService.initializePayment(paymentData);

        default:
          throw new BadRequestException(
            `Unsupported payment provider: ${paymentData.provider}`,
          );
      }
    } catch (error) {
      this.logger.error("Payment initialization failed:", error);
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
          // Extract orderId from txRef BEFORE calling verifyPayment
          // This allows ChapaService to look up the stored shortened txRef from metadata
          let chapaOrderId: string | undefined;
          if (verifyData.txRef.startsWith("TX-")) {
            const withoutPrefix = verifyData.txRef.substring(3);
            const lastDashIndex = withoutPrefix.lastIndexOf("-");
            if (lastDashIndex > 0) {
              chapaOrderId = withoutPrefix.substring(0, lastDashIndex);
              this.logger.log(
                `Extracted orderId for Chapa verification: ${chapaOrderId}`,
              );
            }
          }
          verifyResponse = await this.chapaService.verifyPayment(
            verifyData.txRef,
            chapaOrderId,
          );
          break;

        case PaymentProvider.PAYPAL:
          verifyResponse = await this.paypalService.verifyPayment(
            verifyData.txRef,
          );
          break;

        default:
          throw new BadRequestException(
            `Unsupported payment provider: ${verifyData.provider}`,
          );
      }

      // If payment successful, complete the order
      if (verifyResponse.success && verifyResponse.data.status === "success") {
        let orderId: string | null = null;

        // Extract orderId from txRef
        // For Chapa: format is TX-{orderId}-{timestamp}
        // For PayPal: use originalTxRef if available, otherwise try to extract from txRef
        if (verifyData.provider === "paypal") {
          // For PayPal, check if originalTxRef is available in the response
          const originalTxRef = (verifyResponse.data as any).originalTxRef;
          if (originalTxRef) {
            // Extract orderId from original txRef format: TX-{orderId}-{timestamp}
            // OrderId is a UUID (with dashes), so we need to extract it properly
            // Format: TX-{uuid}-{timestamp}
            if (originalTxRef.startsWith("TX-")) {
              // Remove 'TX-' prefix
              const withoutPrefix = originalTxRef.substring(3);
              // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
              // Find the last occurrence of '-' before the timestamp (which is numeric)
              // Timestamp is at the end, so we can split by last dash
              const lastDashIndex = withoutPrefix.lastIndexOf("-");
              if (lastDashIndex > 0) {
                // Everything before the last dash is the UUID (orderId)
                orderId = withoutPrefix.substring(0, lastDashIndex);
                this.logger.log(
                  `Extracted orderId from originalTxRef: ${orderId}`,
                );
              } else {
                this.logger.warn(
                  `Could not parse originalTxRef format: ${originalTxRef}`,
                );
              }
            }
          } else {
            // Fallback: try to find transaction by PayPal order ID in metadata
            try {
              const transactions = await this.prisma.transaction.findMany({
                where: {
                  metadata: {
                    path: ["paypalOrderId"],
                    equals: verifyData.txRef,
                  },
                },
                include: { order: true },
              });

              if (transactions.length > 0 && transactions[0]?.orderId) {
                orderId = transactions[0].orderId;
                this.logger.log(
                  `Found order ${orderId} for PayPal order ID via metadata: ${verifyData.txRef}`,
                );
              } else {
                this.logger.warn(
                  `Could not find order for PayPal order ID: ${verifyData.txRef}. Original txRef not available.`,
                );
              }
            } catch (lookupError) {
              this.logger.error(
                `Failed to find order for PayPal txRef ${verifyData.txRef}:`,
                lookupError,
              );
            }
          }
        } else {
          // For Chapa, extract from txRef format: TX-{orderId}-{timestamp}
          // OrderId is a UUID (with dashes), so we need to extract it properly
          if (verifyData.txRef.startsWith("TX-")) {
            // Remove 'TX-' prefix
            const withoutPrefix = verifyData.txRef.substring(3);
            // Find the last occurrence of '-' before the timestamp (which is numeric)
            const lastDashIndex = withoutPrefix.lastIndexOf("-");
            if (lastDashIndex > 0) {
              // Everything before the last dash is the UUID (orderId)
              orderId = withoutPrefix.substring(0, lastDashIndex);
              this.logger.log(`Extracted orderId from Chapa txRef: ${orderId}`);
            } else {
              this.logger.warn(
                `Could not parse Chapa txRef format: ${verifyData.txRef}`,
              );
            }
          }
        }

        if (orderId) {
          try {
            // Early check: if order is already PAID, skip processing to prevent duplicate work
            const existingOrder = await this.prisma.order.findUnique({
              where: { id: orderId },
              select: { status: true },
            });

            if (existingOrder?.status === "PAID") {
              this.logger.log(
                `Order ${orderId} already PAID - skipping duplicate verification processing`,
              );
              // Return success response without processing
              return verifyResponse;
            }

            // Get order from database to extract customer information from checkout form
            const order = await this.prisma.order.findUnique({
              where: { id: orderId },
              include: {
                transaction: {
                  select: { metadata: true },
                },
              },
            });

            // Prepare payment metadata with customer info from order (checkout form data)
            const paymentMetadata: {
              customerEmail?: string;
              customerName?: string;
              originalTxRef?: string;
            } = {};

            // Use customer information from the order (checkout form), not from payment provider
            let userId: string | null = null;

            if (order) {
              // Get email from order
              paymentMetadata.customerEmail = order.buyerEmail;

              // Get name from shipping address in transaction metadata
              if (order.transaction?.metadata) {
                const metadata = order.transaction.metadata as any;
                if (metadata.shippingAddress?.fullName) {
                  paymentMetadata.customerName =
                    metadata.shippingAddress.fullName;
                }
              }

              // Get userId from order (now stored directly in Order table) or transaction metadata (fallback)
              // Using type assertion until Prisma client is regenerated
              const orderWithUserId = order as any;
              if (orderWithUserId.userId) {
                userId = orderWithUserId.userId;
              } else {
                // Fallback: Get userId from transaction metadata (for backward compatibility)
                if (order.transaction?.metadata) {
                  const metadata = order.transaction.metadata as any;
                  userId = metadata.userId;
                }
              }

              this.logger.log(
                `Using customer info from order: ${paymentMetadata.customerEmail}, ${paymentMetadata.customerName}, userId: ${userId}`,
              );
            } else {
              // Fallback to payment provider info if order not found
              this.logger.warn(
                `Order ${orderId} not found, using payment provider customer info`,
              );
              if (verifyResponse.data.customerEmail) {
                paymentMetadata.customerEmail =
                  verifyResponse.data.customerEmail;
              }
              if (verifyResponse.data.customerName) {
                paymentMetadata.customerName = verifyResponse.data.customerName;
              }
            }

            // Add userId to verifyResponse
            if (userId && userId !== "guest") {
              (verifyResponse.data as any).userId = userId;
            }

            // Store original txRef in metadata for reference
            // For PayPal: originalTxRef is in the response
            // For Chapa: if we used a shortened txRef, store the original one
            if ((verifyResponse.data as any).originalTxRef) {
              paymentMetadata.originalTxRef = (
                verifyResponse.data as any
              ).originalTxRef;
            } else if (
              verifyData.provider === "chapa" &&
              verifyData.txRef !== verifyResponse.data.txRef
            ) {
              // Chapa: Store original txRef if we used a shortened one
              paymentMetadata.originalTxRef = verifyData.txRef;
              this.logger.log(
                `Chapa: Storing original txRef ${verifyData.txRef} in metadata (Chapa used ${verifyResponse.data.txRef})`,
              );
            }

            // Override the verification response with order's customer information
            if (paymentMetadata.customerEmail) {
              verifyResponse.data.customerEmail = paymentMetadata.customerEmail;
            }
            if (paymentMetadata.customerName) {
              verifyResponse.data.customerName = paymentMetadata.customerName;
            }

            // Complete the order (updates status, marks artworks as SOLD)
            // Note: Withdrawals are no longer automatically created - artists must manually request them
            // This method is idempotent - it checks if order is already PAID
            // Use the txRef from the verification response (what the payment provider actually knows about)
            // For Chapa: this is the shortened txRef if it was shortened, or the original
            // For PayPal: this is the PayPal order ID
            const txRefForCompletion =
              verifyResponse.data.txRef || verifyData.txRef;
            // Extract userId from paymentMetadata if available
            const userIdFromMetadata = (paymentMetadata as any)?.userId;
            const completedOrder = await this.orderService.completeOrder(
              orderId,
              txRefForCompletion,
              verifyData.provider,
              userIdFromMetadata,
            );

            // Get userId from verifyResponse (already set above) for cart operations
            const userIdForCart = (verifyResponse.data as any).userId;

            // Remove purchased artworks from user's cart after successful payment
            if (userIdForCart && userIdForCart !== "guest") {
              try {
                // Use the completed order that was just returned to get artwork IDs
                // This avoids an extra database query
                if (
                  completedOrder &&
                  completedOrder.items &&
                  completedOrder.items.length > 0
                ) {
                  // Remove each purchased artwork from the cart
                  const artworkIds = completedOrder.items.map(
                    (item: any) => item.artworkId,
                  );
                  let removedCount = 0;

                  for (const artworkId of artworkIds) {
                    try {
                      await this.cartService.removeFromCart(
                        userIdForCart,
                        artworkId,
                      );
                      removedCount++;
                      this.logger.log(
                        `Removed artwork ${artworkId} from cart for user ${userIdForCart}`,
                      );
                    } catch (removeError: any) {
                      // If artwork not in cart (already removed or never added), that's okay
                      if (
                        removeError.message?.includes("not found") ||
                        removeError.message?.includes("Cart item not found")
                      ) {
                        this.logger.log(
                          `Artwork ${artworkId} not in cart for user ${userIdForCart} (may have been removed already)`,
                        );
                      } else {
                        this.logger.warn(
                          `Failed to remove artwork ${artworkId} from cart:`,
                          removeError.message,
                        );
                      }
                    }
                  }

                  this.logger.log(
                    `Removed ${removedCount} of ${artworkIds.length} purchased artwork(s) from cart for user ${userIdForCart} after order ${orderId} completion`,
                  );
                } else {
                  this.logger.warn(
                    `Completed order ${orderId} has no items to remove from cart`,
                  );
                }
              } catch (cartError) {
                // Log error but don't fail the payment verification
                // Cart removal is not critical - order is already completed
                this.logger.error(
                  `Failed to remove artworks from cart for user ${userIdForCart} after order ${orderId}:`,
                  cartError,
                );
              }
            } else {
              this.logger.warn(
                `Could not remove artworks from cart: userId not found or is guest for order ${orderId}`,
              );
            }

            this.logger.log(
              `Payment verified and order ${orderId} completed successfully with ${completedOrder.items.length} items`,
            );
          } catch (orderError) {
            // Log error but don't fail payment verification
            // Payment was successful, but order completion failed
            this.logger.error(
              `Payment verified but failed to complete order ${orderId}:`,
              orderError,
            );
            // Note: We still return success because payment was verified
            // The order completion failure should be investigated separately
          }
        } else {
          this.logger.warn(
            `Could not extract orderId from txRef: ${verifyData.txRef} for provider: ${verifyData.provider}`,
          );
        }
      }

      // Handle payment verification failure
      if (!verifyResponse.success || verifyResponse.data.status !== "success") {
        this.logger.warn(
          `Payment verification returned failure for txRef: ${verifyData.txRef}`,
        );

        // Try to find and cancel the associated order
        let orderId: string | null = null;

        // Extract orderId from txRef (same logic as success case)
        if (verifyData.provider === "paypal") {
          const originalTxRef = (verifyResponse.data as any).originalTxRef;
          if (originalTxRef && originalTxRef.startsWith("TX-")) {
            const withoutPrefix = originalTxRef.substring(3);
            const lastDashIndex = withoutPrefix.lastIndexOf("-");
            if (lastDashIndex > 0) {
              orderId = withoutPrefix.substring(0, lastDashIndex);
            }
          }
        } else if (verifyData.txRef.startsWith("TX-")) {
          const withoutPrefix = verifyData.txRef.substring(3);
          const lastDashIndex = withoutPrefix.lastIndexOf("-");
          if (lastDashIndex > 0) {
            orderId = withoutPrefix.substring(0, lastDashIndex);
          }
        }

        // Cancel the order if we found it
        if (orderId) {
          try {
            // Update order status to CANCELLED
            await this.prisma.order.update({
              where: { id: orderId },
              data: { status: "CANCELLED" },
            });
            this.logger.log(
              `Cancelled order ${orderId} due to payment failure`,
            );
          } catch (cancelError) {
            this.logger.error(
              `Failed to cancel order ${orderId} after payment failure:`,
              cancelError,
            );
          }
        }
      }

      return verifyResponse;
    } catch (error: any) {
      this.logger.error("Payment verification failed:", error);

      // If verification throws an error (e.g., capture failed), try to cancel the order
      // Extract orderId from txRef if possible
      let orderId: string | null = null;

      try {
        if (verifyData.txRef.startsWith("TX-")) {
          const withoutPrefix = verifyData.txRef.substring(3);
          const lastDashIndex = withoutPrefix.lastIndexOf("-");
          if (lastDashIndex > 0) {
            orderId = withoutPrefix.substring(0, lastDashIndex);
          }
        }

        if (orderId) {
          try {
            // Update order status to CANCELLED
            await this.prisma.order.update({
              where: { id: orderId },
              data: { status: "CANCELLED" },
            });
            this.logger.log(
              `Cancelled order ${orderId} due to verification error`,
            );
          } catch (cancelError) {
            this.logger.error(
              `Failed to cancel order ${orderId} after verification error:`,
              cancelError,
            );
          }
        }
      } catch (extractError) {
        this.logger.error(
          "Failed to extract orderId for cancellation:",
          extractError,
        );
      }

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
   * Processes both payment and payout webhooks
   */
  async handlePaypalWebhook(payload: any, headers?: any): Promise<any> {
    try {
      const webhookResult = await this.paypalService.handleWebhook(
        payload,
        headers,
      );

      // Handle payout batch webhooks
      if (webhookResult.eventType === "PAYOUT_BATCH") {
        await this.handlePayoutBatchWebhook(webhookResult);
      }

      // Handle payout item webhooks (individual payout status)
      if (webhookResult.eventType === "PAYOUT_ITEM") {
        await this.handlePayoutItemWebhook(webhookResult);
      }

      return webhookResult;
    } catch (error: any) {
      // Log error but don't throw - always return success to PayPal
      this.logger.error(
        `PayPal webhook processing error: ${error.message || error}`,
      );
      return {
        success: false,
        message: "Webhook received but processing failed",
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Handle payout batch webhook events
   * Updates withdrawal status based on batch status
   */
  private async handlePayoutBatchWebhook(webhookResult: any): Promise<void> {
    try {
      const { payoutBatchId, status } = webhookResult;

      if (!payoutBatchId) {
        this.logger.error(`Payout batch webhook missing batch ID`);
        return;
      }

      // Find withdrawal by payout batch ID (check both column and metadata)
      let withdrawal = await this.prisma.withdrawal.findFirst({
        where: {
          payoutBatchId: payoutBatchId as any,
        } as any,
      });

      if (!withdrawal) {
        // If not found by column, check metadata (fallback for older records)
        const withdrawals = await this.prisma.withdrawal.findMany({
          where: {
            status: {
              in: ["PROCESSING", "INITIATED"] as any,
            },
          } as any,
        });

        withdrawal = withdrawals.find((w: any) => {
          const metadata = w.metadata as any;
          return metadata?.payoutBatchId === payoutBatchId;
        }) as any;
      }

      if (withdrawal) {
        // Determine system status from PayPal batch status
        let newStatus = withdrawal.status;
        const statusUpper = status?.toUpperCase();

        if (statusUpper === "SUCCESS" || statusUpper === "COMPLETED") {
          newStatus = "COMPLETED";
        } else if (statusUpper === "DENIED" || statusUpper === "FAILED") {
          newStatus = "FAILED";
        } else if (statusUpper === "PENDING") {
          newStatus = "PROCESSING";
        }

        // Store batch status in metadata and update system status
        const withdrawalWithMetadata = withdrawal as any;
        const updateData: any = {
          metadata: {
            ...(withdrawalWithMetadata.metadata || {}),
            batchWebhookStatus: status,
            payoutBatchId: payoutBatchId,
            batchWebhookProcessedAt: new Date().toISOString(),
          } as any,
        };

        // Update status if it changed
        if (newStatus !== withdrawal.status) {
          updateData.status = newStatus;
          this.logger.log(
            `Withdrawal ${withdrawal.id} status updated to ${newStatus} via batch webhook`,
          );
        }

        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: updateData as any,
        });
      } else {
        this.logger.warn(
          `No withdrawal found for payout batch ID: ${payoutBatchId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to handle payout batch webhook: ${error.message || error}`,
      );
    }
  }

  /**
   * Handle payout item webhook events
   * Updates withdrawal status based on PayPal batch status (not transaction status)
   * Transaction status is stored in metadata for reference
   */
  private async handlePayoutItemWebhook(webhookResult: any): Promise<void> {
    try {
      const { payoutItemId, transactionId, transactionStatus, payoutBatchId } =
        webhookResult;

      if (!transactionId && !payoutItemId) {
        this.logger.error(`Payout item webhook missing transaction/item ID`);
        return;
      }

      if (!payoutBatchId) {
        this.logger.error(`Payout item webhook missing batch ID`);
        return;
      }

      // Find withdrawal by payout batch ID (check both column and metadata)
      let withdrawal = await this.prisma.withdrawal.findFirst({
        where: {
          payoutBatchId: payoutBatchId as any,
        } as any,
      });

      if (!withdrawal) {
        // If not found by column, check metadata (fallback for older records)
        const withdrawals = await this.prisma.withdrawal.findMany({
          where: {
            status: {
              in: ["PROCESSING", "INITIATED"] as any,
            },
          } as any,
        });

        withdrawal = withdrawals.find((w: any) => {
          const metadata = w.metadata as any;
          return metadata?.payoutBatchId === payoutBatchId;
        }) as any;
      }

      if (!withdrawal) {
        this.logger.warn(
          `No withdrawal found for payout batch ID: ${payoutBatchId}`,
        );
        return;
      }

      // Determine system status from PayPal transaction status
      let newStatus = withdrawal.status;
      const transactionStatusUpper = transactionStatus?.toUpperCase();

      if (transactionStatusUpper === "SUCCESS") {
        newStatus = "COMPLETED";
      } else if (
        transactionStatusUpper === "FAILED" ||
        transactionStatusUpper === "DENIED" ||
        transactionStatusUpper === "BLOCKED"
      ) {
        newStatus = "FAILED";
      } else if (transactionStatusUpper === "UNCLAIMED") {
        // UNCLAIMED means payout was sent but recipient hasn't claimed it
        // This is still a success from our perspective
        newStatus = "COMPLETED";
      } else if (
        transactionStatusUpper === "RETURNED" ||
        transactionStatusUpper === "REFUNDED"
      ) {
        newStatus = "REFUNDED";
      } else if (
        transactionStatusUpper === "PENDING" ||
        transactionStatusUpper === "ONHOLD"
      ) {
        newStatus = "PROCESSING";
      }

      // Store PayPal transaction status in metadata
      const withdrawalWithMetadata = withdrawal as any;
      const metadataUpdate: any = {
        ...(withdrawalWithMetadata.metadata || {}),
        webhookTransactionId: transactionId,
        webhookTransactionStatus: transactionStatus,
        payoutBatchId: payoutBatchId,
        webhookProcessedAt: new Date().toISOString(),
      };

      // Add note for UNCLAIMED transaction status
      if (transactionStatusUpper === "UNCLAIMED") {
        metadataUpdate.paypalNote =
          "Payout sent successfully. Recipient needs to claim it in their PayPal account.";
      }

      const updateData: any = {
        metadata: metadataUpdate,
      };

      // Update status if it changed
      if (newStatus !== withdrawal.status) {
        updateData.status = newStatus;
        this.logger.log(
          `Withdrawal ${withdrawal.id} status updated to ${newStatus} via webhook`,
        );
      }

      const updatedWithdrawal = await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: updateData as any,
      });

      // Create transaction record when withdrawal is completed via webhook
      // This ensures withdrawal transactions are created even when status changes via webhook
      if (newStatus === "COMPLETED" && withdrawal.userId) {
        this.logger.log(
          `[WEBHOOK-WITHDRAWAL] Withdrawal ${withdrawal.id} completed via webhook, creating transaction...`,
        );
        await this.withdrawalsService.createWithdrawalTransaction(
          withdrawal.id,
          withdrawal.userId,
          withdrawal.amount,
          withdrawal.payoutAccount,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to handle payout item webhook: ${error.message || error}`,
      );
    }
  }

  /**
   * Capture PayPal payment
   */
  async capturePaypalPayment(orderId: string): Promise<any> {
    return this.paypalService.capturePayment(orderId);
  }
}
