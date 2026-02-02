import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus } from "@prisma/client";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Get user by email (helper for order creation)
   */
  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  /**
   * Create a new order from cart items
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    try {
      this.logger.log(`Creating order for authenticated user: ${userId}`);

      // Validate userId is provided (should never be 'guest' since we require authentication)
      if (!userId || userId === "guest") {
        throw new BadRequestException(
          "Valid user ID is required to create an order",
        );
      }

      // Validate artworks exist and are available (only APPROVED artworks can be purchased)
      const artworkIds = createOrderDto.items.map((item) => item.artworkId);
      const artworks = await this.prisma.artwork.findMany({
        where: {
          id: { in: artworkIds },
          status: "APPROVED", // Only APPROVED artworks can be purchased
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (artworks.length !== artworkIds.length) {
        throw new BadRequestException("Some artworks are not available");
      }

      // Prevent users from purchasing their own artwork
      const ownArtworks = artworks.filter(
        (artwork) => artwork.userId === userId,
      );
      if (ownArtworks.length > 0) {
        const artworkTitles = ownArtworks
          .map((a) => a.title || a.id)
          .join(", ");
        throw new BadRequestException(
          `You cannot purchase your own artwork: ${artworkTitles}`,
        );
      }

      // Calculate totals
      let subtotal = 0;
      const orderItemsData = createOrderDto.items.map((item) => {
        const artwork = artworks.find((a) => a.id === item.artworkId);
        if (!artwork) {
          throw new BadRequestException(`Artwork ${item.artworkId} not found`);
        }

        const itemTotal = Number(artwork.desiredPrice) * item.quantity;
        subtotal += itemTotal;

        return {
          artworkId: item.artworkId,
          quantity: item.quantity,
          price: new Decimal(artwork.desiredPrice),
        };
      });

      // Get platform commission rate from settings
      const platformCommissionRate =
        await this.settingsService.getPlatformCommissionRate();
      const platformFee = subtotal * platformCommissionRate;
      const totalAmount = subtotal + platformFee;

      // Create order with transaction
      // userId is always attached from authenticated session (never 'guest')
      const order = await this.prisma.order.create({
        data: {
          buyerEmail: createOrderDto.buyerEmail,
          userId: userId, // Store authenticated userId directly in order
          totalAmount: new Decimal(totalAmount),
          status: "PENDING",
          updatedAt: new Date(),
          items: {
            create: orderItemsData,
          },
          transaction: {
            create: {
              amount: new Decimal(totalAmount),
              status: "INITIATED",
              metadata: JSON.parse(
                JSON.stringify({
                  subtotal,
                  platformFee,
                  platformCommissionRate,
                  shippingAddress: createOrderDto.shippingAddress,
                  paymentMethod: createOrderDto.paymentMethod,
                  userId, // Keep in metadata for backward compatibility
                }),
              ),
            },
          },
        } as any, // Temporary type assertion until Prisma client is regenerated
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
          transaction: true,
        },
      });

      this.logger.log(`Order created: ${order.id}`);

      return {
        orderId: order.id,
        txRef: `TX-${order.id}-${Date.now()}`,
        totalAmount: Number(order.totalAmount),
        subtotal,
        platformFee,
        items: (order.items || []).map((item: any) => ({
          artworkId: item.artworkId,
          artworkTitle: item.artwork?.title,
          artistName: item.artwork?.user?.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
      };
    } catch (error) {
      this.logger.error("Order creation failed:", error);
      throw error;
    }
  }

  /**
   * Complete order after successful payment
   * @param orderId - Order ID to complete
   * @param txRef - Transaction reference from payment provider
   * @param paymentProvider - Payment provider (chapa, paypal)
   * @param paymentMetadata - Optional additional payment metadata (customerEmail, customerName, originalTxRef, etc.)
   */
  async completeOrder(
    orderId: string,
    txRef: string,
    paymentProvider: string,
    paymentMetadata?: {
      customerEmail?: string;
      customerName?: string;
      originalTxRef?: string;
      [key: string]: any;
    },
  ) {
    try {
      this.logger.log(
        `Completing order: ${orderId} with provider: ${paymentProvider}`,
      );

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              artwork: {
                include: {
                  user: true,
                },
              },
            },
          },
          transaction: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Idempotency check: If order is already PAID, return early
      if (order.status === "PAID") {
        this.logger.warn(
          `Order ${orderId} already paid - skipping completion (idempotency)`,
        );
        return order;
      }

      // Build enhanced metadata with payment provider info and customer data
      const existingMetadata = (order.transaction?.metadata as any) || {};
      const enhancedMetadata = {
        ...existingMetadata,
        txRef,
        paymentProvider,
        verifiedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        // Add PayPal-specific metadata if provided
        ...(paymentProvider === "paypal" && {
          paypalOrderId: txRef,
          ...(paymentMetadata?.originalTxRef && {
            originalTxRef: paymentMetadata.originalTxRef,
          }),
          ...(paymentMetadata?.customerEmail && {
            customerEmail: paymentMetadata.customerEmail,
          }),
          ...(paymentMetadata?.customerName && {
            customerName: paymentMetadata.customerName,
          }),
        }),
        // Add Chapa-specific metadata if provided
        ...(paymentProvider === "chapa" &&
          paymentMetadata?.customerEmail && {
            customerEmail: paymentMetadata.customerEmail,
          }),
        ...(paymentProvider === "chapa" &&
          paymentMetadata?.customerName && {
            customerName: paymentMetadata.customerName,
          }),
      };

      // Update order and transaction atomically
      // If transaction doesn't exist, create it; otherwise update it
      if (!order.transaction) {
        this.logger.warn(
          `Order ${orderId} has no transaction - creating new transaction record`,
        );
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          transaction: order.transaction
            ? {
                // Transaction exists - update it to COMPLETED
                update: {
                  status: "COMPLETED",
                  metadata: enhancedMetadata,
                },
              }
            : {
                // Transaction doesn't exist - create it with COMPLETED status
                create: {
                  amount: order.totalAmount,
                  status: "COMPLETED",
                  metadata: enhancedMetadata,
                },
              },
        },
        include: {
          items: {
            include: {
              artwork: true,
            },
          },
          transaction: true,
        },
      });

      // Mark artworks as SOLD (critical: this is irreversible)
      const artworkIds = order.items.map((item) => item.artworkId);
      const artworkUpdateResult = await this.prisma.artwork.updateMany({
        where: { id: { in: artworkIds } },
        data: { status: "SOLD" },
      });

      this.logger.log(
        `Marked ${artworkUpdateResult.count} artwork(s) as SOLD for order ${orderId}`,
      );

      // Note: Withdrawals are no longer automatically created
      // Artists must manually request withdrawals from their earnings
      // Earnings are tracked and available for withdrawal via getEarningsStats()

      this.logger.log(
        `Order ${orderId} completed successfully with ${order.items.length} items`,
      );

      return updatedOrder;
    } catch (error) {
      this.logger.error(`Order completion failed for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel/fail an order when payment fails
   * @param orderId - Order ID to cancel
   * @param reason - Reason for cancellation (e.g., payment failed)
   */
  async cancelOrder(orderId: string, reason?: string) {
    try {
      this.logger.log(
        `Cancelling order: ${orderId}, reason: ${reason || "Payment failed"}`,
      );

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          transaction: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Don't cancel if already paid or cancelled
      if (order.status === "PAID") {
        this.logger.warn(`Cannot cancel order ${orderId} - already paid`);
        return order;
      }

      if (order.status === "CANCELLED") {
        this.logger.warn(`Order ${orderId} already cancelled`);
        return order;
      }

      // Update order status to CANCELLED
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          updatedAt: new Date(),
          transaction: order.transaction
            ? {
                update: {
                  status: "FAILED",
                  metadata: {
                    ...((order.transaction.metadata as any) || {}),
                    cancellationReason: reason || "Payment failed",
                    cancelledAt: new Date().toISOString(),
                  },
                },
              }
            : undefined,
        },
        include: {
          items: {
            include: {
              artwork: true,
            },
          },
          transaction: true,
        },
      });

      this.logger.log(`Order ${orderId} cancelled successfully`);

      return updatedOrder;
    } catch (error) {
      this.logger.error(
        `Order cancellation failed for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
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
        transaction: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  /**
   * Get all orders with pagination and filters
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: OrderStatus,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { buyerEmail: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ];
      }

      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
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
            transaction: true,
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Failed to fetch orders:", error);
      throw error;
    }
  }

  /**
   * Get user's orders by userId (directly from Order table)
   * This is the secure way to fetch orders for authenticated users
   * ONLY uses userId - not email - because users may use different emails for checkout
   */
  async getUserOrdersByUserId(userId: string) {
    try {
      this.logger.log(`Fetching orders for userId: ${userId}`);

      // Query orders directly by userId field (much simpler and more efficient)
      const orders = await this.prisma.order.findMany({
        where: {
          userId: userId,
        } as any, // Temporary type assertion until Prisma client is regenerated
        include: {
          items: {
            include: {
              artwork: {
                select: {
                  id: true,
                  title: true,
                  artist: true,
                  photos: true,
                  desiredPrice: true,
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
          transaction: true,
        },
        orderBy: { createdAt: "desc" },
      });

      this.logger.log(`Found ${orders.length} orders for userId: ${userId}`);
      return orders;
    } catch (error) {
      this.logger.error(`Failed to fetch orders for userId ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's orders by email (legacy method - kept for backward compatibility)
   */
  async getUserOrders(userEmail: string) {
    return this.prisma.order.findMany({
      where: { buyerEmail: userEmail },
      include: {
        items: {
          include: {
            artwork: {
              select: {
                id: true,
                title: true,
                artist: true,
                photos: true,
                desiredPrice: true,
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
        transaction: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
