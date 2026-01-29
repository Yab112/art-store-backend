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

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService
  ) { }

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
      if (!userId || userId === 'guest') {
        throw new BadRequestException('Valid user ID is required to create an order');
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
        (artwork) => artwork.userId === userId
      );
      if (ownArtworks.length > 0) {
        const artworkTitles = ownArtworks
          .map((a) => a.title || a.id)
          .join(", ");
        throw new BadRequestException(
          `You cannot purchase your own artwork: ${artworkTitles}`
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

      // Platform fee is now inclusive in the desiredPrice
      // Total amount the buyer pays is exactly the subtotal of desired prices
      const platformFee = subtotal * platformCommissionRate;
      const totalAmount = subtotal;

      // Generate shorter txRef for Chapa (max 50 chars)
      // Format: TX-{first8charsOfOrderId}-{timestamp}
      // This ensures it's always under 50 characters
      // We'll generate it after order creation to use the actual order ID
      const timestamp = Date.now();

      // Try to get userId from email if it's 'guest' or null
      let finalUserId = userId !== 'guest' ? userId : null;
      if (!finalUserId) {
        try {
          const userByEmail = await this.getUserByEmail(createOrderDto.buyerEmail);
          if (userByEmail?.id) {
            finalUserId = userByEmail.id;
            this.logger.log(`Found user by email during order creation: ${createOrderDto.buyerEmail} -> ${finalUserId}`);
          }
        } catch (error) {
          this.logger.warn(`Could not find user by email ${createOrderDto.buyerEmail} during order creation`);
        }
      }

      // Create order with transaction
      // userId is always attached from authenticated session (never 'guest')
      const order = await this.prisma.order.create({
        data: {
          buyerEmail: createOrderDto.buyerEmail,
          userId: finalUserId, // Set userId if found, otherwise null
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
                })
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

      // Generate shorter txRef for Chapa (max 50 chars)
      // Format: TX-{fullOrderId}-{shortTimestamp}
      // Use full order ID but shorten timestamp to stay under 50 chars
      // Full UUID is 36 chars, "TX-" is 3 chars, "-" is 1 char = 40 chars
      // This leaves 10 chars for timestamp (use last 8 digits of timestamp)
      const shortTimestamp = timestamp.toString().slice(-8); // Last 8 digits
      const txRef = `TX-${order.id}-${shortTimestamp}`;

      // Update transaction metadata to include txRef for verification
      await this.prisma.transaction.update({
        where: { id: order.transaction.id },
        data: {
          metadata: {
            ...(order.transaction.metadata as any),
            txRef: txRef,
          },
        },
      });

      return {
        orderId: order.id,
        txRef: txRef,
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
  async completeOrder(orderId: string, txRef: string, paymentProvider: string, userId?: string) {
    try {
      this.logger.log(`[ORDER-COMPLETE] ========================================`);
      this.logger.log(`[ORDER-COMPLETE] Starting order completion for order: ${orderId}`);
      this.logger.log(`[ORDER-COMPLETE] Payment provider: ${paymentProvider}, txRef: ${txRef}`);
      this.logger.log(`[ORDER-COMPLETE] Buyer userId: ${userId || 'N/A'}`);

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
        this.logger.error(`[ORDER-COMPLETE] ❌ Order ${orderId} not found`);
        throw new NotFoundException("Order not found");
      }

      this.logger.log(`[ORDER-COMPLETE] Order found: ${orderId}, Status: ${order.status}, Items: ${order.items.length}`);

      if (order.status === "PAID") {
        this.logger.warn(`[ORDER-COMPLETE] ⚠️ Order ${orderId} already paid - skipping completion`);
        // Return order with items included for cart clearing
        return await this.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                artwork: true,
              },
            },
            transaction: true,
          },
        });
      }

      // Update order and transaction
      this.logger.log(`[ORDER-COMPLETE] Updating order status to PAID...`);

      // Build enhanced metadata with payment completion details
      const enhancedMetadata = {
        ...(order.transaction?.metadata as any || {}),
        txRef,
        paymentProvider,
        completedAt: new Date().toISOString(),
        ...(userId ? { buyerUserId: userId } : {}),
      };

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
      this.logger.log(`[ORDER-COMPLETE] ✅ Order status updated to PAID`);

      // Mark artworks as SOLD
      this.logger.log(`[ORDER-COMPLETE] Marking artworks as SOLD...`);
      const artworkIds = order.items.map((item) => item.artworkId);
      const artworkUpdateResult = await this.prisma.artwork.updateMany({
        where: { id: { in: artworkIds } },
        data: { status: "SOLD" },
      });
      this.logger.log(`[ORDER-COMPLETE] ✅ Marked ${artworkUpdateResult.count} artwork(s) as SOLD`);

      // Calculate artist earnings and create withdrawal entries
      this.logger.log(`[ORDER-COMPLETE] Calculating earnings and commissions...`);
      const metadata = order.transaction.metadata as any;
      const platformCommissionRate =
        metadata.platformCommissionRate ||
        (await this.settingsService.getPlatformCommissionRate());

      this.logger.log(`[ORDER-COMPLETE] Platform commission rate: ${platformCommissionRate} (${(platformCommissionRate * 100).toFixed(2)}%)`);

      let totalPlatformCommission = 0;
      let totalOrderValue = 0;

      // Track earnings per artist to update user earning field
      const artistEarningsMap = new Map<string, number>();

      for (const item of order.items) {
        const itemPrice = Number(item.price) * item.quantity;
        const platformCommission = itemPrice * platformCommissionRate;
        const artistAmount = itemPrice - platformCommission;
        totalPlatformCommission += platformCommission;
        totalOrderValue += itemPrice;

        this.logger.log(
          `[ORDER-COMPLETE] Item: ${item.artworkId}, Price: ${itemPrice}, Platform Fee: ${platformCommission}, Artist Amount: ${artistAmount}`
        );

        // Track earnings for this artist
        const currentEarnings = artistEarningsMap.get(item.artwork.userId) || 0;
        artistEarningsMap.set(item.artwork.userId, currentEarnings + artistAmount);
      }

      // Update user earnings and create seller transactions for each artist
      for (const [artistUserId, earnings] of artistEarningsMap.entries()) {
        // Update user earnings
        await this.prisma.user.update({
          where: { id: artistUserId },
          data: {
            earning: {
              increment: new Decimal(earnings),
            },
          },
        });
        this.logger.log(
          `[SELLER-EARNING] Updated earnings for artist ${artistUserId}: +${earnings} (Total earning updated)`
        );

        // Create seller transaction record
        // This represents the seller receiving money from the sale
        try {
          const sellerTransaction = await this.prisma.transaction.create({
            data: {
              sellerId: artistUserId,
              orderId: null, // Seller transactions don't link directly to order (buyer transaction does)
              amount: new Decimal(earnings),
              status: "COMPLETED", // Payment was successful, so seller receives money
              metadata: {
                type: "SELLER_PAYMENT",
                orderId: orderId,
                buyerTransactionId: order.transaction?.id || null,
                paymentProvider,
                txRef,
                createdAt: new Date().toISOString(),
              },
            },
          });
          this.logger.log(
            `[SELLER-TRANSACTION] ✅ Created seller transaction for artist ${artistUserId}: ${earnings} (Transaction ID: ${sellerTransaction.id})`
          );
        } catch (sellerTxError: any) {
          // Log error but don't fail order completion
          this.logger.error(
            `[SELLER-TRANSACTION] ❌ Failed to create seller transaction for artist ${artistUserId}:`,
            sellerTxError
          );
          this.logger.error(
            `[SELLER-TRANSACTION] Error: ${sellerTxError?.message || 'Unknown error'}`
          );
        }
      }

      // Create platform earning record
      try {
        await this.createPlatformEarning(
          updatedOrder,
          totalPlatformCommission,
          platformCommissionRate,
          paymentProvider,
          txRef,
          orderId
        );
      } catch (platformEarningError: any) {
        // Log error but don't fail order completion
        // Platform earnings are important but order completion should still succeed
        this.logger.error(
          `[ORDER-COMPLETE] ⚠️ Platform earning creation failed for order ${orderId}, but order completion continues:`,
          platformEarningError
        );
        // Continue with order completion even if platform earning fails
      }

      // Clear user's cart after successful order completion
      if (userId && userId !== 'guest') {
        try {
          const artworkIds = updatedOrder.items.map((item: any) => item.artworkId);

          this.logger.log(`[ORDER-COMPLETE] 🛒 Clearing cart for user ${userId}: removing ${artworkIds.length} purchased artwork(s)`);

          const deleteResult = await this.prisma.cartItem.deleteMany({
            where: {
              userId: userId,
              artworkId: {
                in: artworkIds,
              },
            },
          });

          this.logger.log(`[ORDER-COMPLETE] ✅ Successfully removed ${deleteResult.count} purchased artwork(s) from cart for user ${userId}`);
          this.logger.log(`[ORDER-COMPLETE] Removed artwork IDs: ${artworkIds.join(', ')}`);
        } catch (cartError) {
          // Log error but don't fail order completion
          this.logger.error(`[ORDER-COMPLETE] ❌ Failed to remove artworks from cart for user ${userId} after order ${orderId}:`, cartError);
        }
      } else {
        this.logger.warn(`[ORDER-COMPLETE] ⚠️ Could not clear cart: userId not provided or is guest for order ${orderId}`);
      }

      this.logger.log(`[ORDER-COMPLETE] ========================================`);
      this.logger.log(`[ORDER-COMPLETE] ✅ Order ${orderId} completed successfully`);
      this.logger.log(`[ORDER-COMPLETE] Summary:`);
      this.logger.log(`[ORDER-COMPLETE]   - Total order value: ${totalOrderValue}`);
      this.logger.log(`[ORDER-COMPLETE]   - Total platform commission: ${totalPlatformCommission}`);
      this.logger.log(`[ORDER-COMPLETE]   - Number of artists: ${artistEarningsMap.size}`);
      this.logger.log(`[ORDER-COMPLETE]   - Artworks marked as SOLD: ${artworkIds.length}`);
      this.logger.log(`[ORDER-COMPLETE] ========================================`);

      return updatedOrder;
    } catch (error) {
      this.logger.error(`Order cancellation failed for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Create platform earning record for a completed order
   */
  private async createPlatformEarning(
    order: any,
    totalPlatformCommission: number,
    platformCommissionRate: number,
    paymentProvider: string,
    txRef: string,
    orderId: string
  ): Promise<void> {
    try {
      this.logger.log(`[PLATFORM-EARNING] Creating platform earning for order ${orderId}`);
      this.logger.log(`[PLATFORM-EARNING] Total commission: ${totalPlatformCommission}, Rate: ${platformCommissionRate}`);

      // Check if platformEarning model exists in Prisma client
      if (!this.prisma.platformEarning) {
        this.logger.error(`[PLATFORM-EARNING] ❌ PlatformEarning model not found in Prisma client. Please run 'npx prisma generate'`);
        throw new Error("PlatformEarning model not available. Database migration may be required.");
      }

      // Check if platform earning already exists for this order (idempotency)
      const existingEarning = await this.prisma.platformEarning.findUnique({
        where: { orderId: order.id },
      });

      if (existingEarning) {
        this.logger.log(
          `[PLATFORM-EARNING] ⚠️ Platform earning already exists for order ${orderId} - skipping creation`
        );
        return;
      }

      // Validate data before creation
      if (totalPlatformCommission <= 0) {
        this.logger.warn(`[PLATFORM-EARNING] ⚠️ Total platform commission is ${totalPlatformCommission} - creating record anyway`);
      }

      if (!order.transaction?.id) {
        this.logger.warn(`[PLATFORM-EARNING] ⚠️ Order ${orderId} has no transaction ID - creating platform earning without transaction link`);
      }

      const platformEarning = await this.prisma.platformEarning.create({
        data: {
          orderId: order.id,
          transactionId: order.transaction?.id || null,
          amount: new Decimal(totalPlatformCommission),
          commissionRate: new Decimal(platformCommissionRate),
          orderData: {
            id: order.id,
            buyerEmail: order.buyerEmail,
            totalAmount: Number(order.totalAmount),
            status: order.status,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            items: order.items.map((item: any) => ({
              id: item.id,
              artworkId: item.artworkId,
              quantity: item.quantity,
              price: Number(item.price),
              artwork: {
                id: item.artwork.id,
                title: item.artwork.title,
                artist: item.artwork.artist,
                userId: item.artwork.userId,
              },
            })),
            transaction: order.transaction
              ? {
                id: order.transaction.id,
                paymentGatewayId: order.transaction.paymentGatewayId,
                status: order.transaction.status,
                amount: Number(order.transaction.amount),
                metadata: order.transaction.metadata,
                createdAt: order.transaction.createdAt.toISOString(),
              }
              : null,
          },
          metadata: {
            paymentProvider,
            txRef,
            commissionRate: platformCommissionRate,
            createdAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(
        `[PLATFORM-EARNING] ✅ Created platform earning for order ${orderId}: ${totalPlatformCommission} (Rate: ${platformCommissionRate})`
      );
      this.logger.log(
        `[PLATFORM-EARNING] Platform earning ID: ${platformEarning.id}`
      );
    } catch (platformEarningError: any) {
      // Log detailed error information
      this.logger.error(
        `[PLATFORM-EARNING] ❌ Failed to create platform earning for order ${orderId}:`,
        platformEarningError
      );
      this.logger.error(
        `[PLATFORM-EARNING] Error message: ${platformEarningError?.message || 'Unknown error'}`
      );
      this.logger.error(
        `[PLATFORM-EARNING] Error stack: ${platformEarningError?.stack || 'No stack trace'}`
      );

      // Check for specific error types
      if (platformEarningError?.message?.includes('Unknown model') ||
        platformEarningError?.message?.includes('platformEarning')) {
        this.logger.error(
          `[PLATFORM-EARNING] ❌ PlatformEarning model not found. Please ensure:\n` +
          `1. Database migration has been applied: npx prisma migrate deploy\n` +
          `2. Prisma client has been regenerated: npx prisma generate\n` +
          `3. Server has been restarted after Prisma client regeneration`
        );
      }

      // Re-throw the error so order completion can handle it appropriately
      // This ensures we know when platform earnings fail to create
      throw new Error(`Failed to create platform earning: ${platformEarningError?.message || 'Unknown error'}`);
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
    status?: string
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
          { userId: { contains: search, mode: "insensitive" } },
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
   * Get user's orders by userId (preferred) or email (fallback)
   * Checks both userId AND buyerEmail to catch orders created before userId was set
   */
  async getUserOrders(userId?: string, userEmail?: string) {
    const where: any = {};

    // If we have both userId and userEmail, check both to catch all orders
    // This handles cases where orders were created with userId=null but have buyerEmail
    if (userId && userEmail) {
      where.OR = [
        { userId: userId },
        { buyerEmail: userEmail },
      ];
    } else if (userId) {
      // If only userId, also try to get user email to check buyerEmail
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user?.email) {
          where.OR = [
            { userId: userId },
            { buyerEmail: user.email },
          ];
        } else {
          where.userId = userId;
        }
      } catch (error) {
        // Fallback to just userId if user lookup fails
        where.userId = userId;
      }
    } else if (userEmail) {
      where.buyerEmail = userEmail;
    } else {
      throw new BadRequestException("Either userId or userEmail must be provided");
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            artwork: {
              select: {
                id: true,
                title: true,
                artist: true,
                photos: true,
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

  /**
   * Get platform commission analytics (admin only)
   */
  async getPlatformCommissionAnalytics(
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string
  ) {
    try {
      // Check if platformEarning model exists in Prisma client
      if (!this.prisma.platformEarning) {
        this.logger.error("PlatformEarning model not found in Prisma client. Please run 'npx prisma generate'");
        throw new Error("PlatformEarning model not available. Database migration may be required.");
      }

      // Build date filter
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.createdAt.lte = new Date(endDate);
        }
      }

      // Get total statistics
      const [totalCount, totalAggregate, recentEarnings] = await Promise.all([
        this.prisma.platformEarning.count({
          where: dateFilter,
        }),
        this.prisma.platformEarning.aggregate({
          where: dateFilter,
          _sum: {
            amount: true,
          },
          _avg: {
            amount: true,
          },
          _min: {
            amount: true,
          },
          _max: {
            amount: true,
          },
        }),
        this.prisma.platformEarning.findMany({
          where: dateFilter,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            order: {
              select: {
                id: true,
                buyerEmail: true,
                totalAmount: true,
                status: true,
                createdAt: true,
              },
            },
            transaction: {
              select: {
                id: true,
                status: true,
                paymentGatewayId: true,
              },
            },
          },
        }),
      ]);

      // Get monthly breakdown (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const monthlyEarnings = await this.prisma.platformEarning.findMany({
        where: {
          ...dateFilter,
          createdAt: {
            ...(dateFilter.createdAt || {}),
            gte: startDate
              ? new Date(startDate)
              : twelveMonthsAgo,
            lte: endDate ? new Date(endDate) : new Date(),
          },
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by month
      const monthlyBreakdown: Record<string, { month: string; total: number; count: number }> = {};

      monthlyEarnings.forEach((earning) => {
        const date = new Date(earning.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthlyBreakdown[monthKey]) {
          monthlyBreakdown[monthKey] = {
            month: monthKey,
            total: 0,
            count: 0,
          };
        }

        monthlyBreakdown[monthKey].total += Number(earning.amount);
        monthlyBreakdown[monthKey].count += 1;
      });

      // Convert to array and sort
      const monthlyBreakdownArray = Object.values(monthlyBreakdown).sort(
        (a, b) => a.month.localeCompare(b.month)
      );

      // Format recent earnings
      const formattedEarnings = recentEarnings.map((earning) => ({
        id: earning.id,
        orderId: earning.orderId,
        transactionId: earning.transactionId,
        amount: Number(earning.amount),
        commissionRate: Number(earning.commissionRate),
        order: earning.order,
        transaction: earning.transaction,
        metadata: earning.metadata,
        createdAt: earning.createdAt,
        updatedAt: earning.updatedAt,
      }));

      return {
        success: true,
        statistics: {
          totalEarnings: Number(totalAggregate._sum.amount || 0),
          totalCount,
          averageEarning: Number(totalAggregate._avg.amount || 0),
          minEarning: Number(totalAggregate._min.amount || 0),
          maxEarning: Number(totalAggregate._max.amount || 0),
        },
        monthlyBreakdown: monthlyBreakdownArray,
        recentEarnings: formattedEarnings,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error: any) {
      this.logger.error("Failed to get platform commission analytics:", error);

      // Provide more helpful error messages
      if (error?.message?.includes("Unknown model") || error?.message?.includes("platformEarning")) {
        throw new Error(
          "PlatformEarning model not found. Please ensure:\n" +
          "1. Database migration has been applied: npx prisma migrate deploy\n" +
          "2. Prisma client has been regenerated: npx prisma generate\n" +
          "3. Server has been restarted after Prisma client regeneration"
        );
      }

      throw error;
    }
  }
}
