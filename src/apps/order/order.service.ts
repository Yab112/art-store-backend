import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly PLATFORM_COMMISSION_RATE = 0.1; // 10% commission

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new order from cart items
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    try {
      this.logger.log(`Creating order for user: ${userId}`);

      // Validate input
      const artworkIds = createOrderDto.items.map((item) => item.artworkId);

      // Check for duplicate artwork IDs
      const uniqueArtworkIds = [...new Set(artworkIds)];
      if (uniqueArtworkIds.length !== artworkIds.length) {
        throw new BadRequestException("Duplicate artwork IDs in order");
      }

      // Validate quantity (artworks are unique items, quantity should be 1)
      const invalidQuantity = createOrderDto.items.some(
        (item) => item.quantity !== 1
      );
      if (invalidQuantity) {
        throw new BadRequestException("Artwork quantity must be 1");
      }

      // Validate artworks exist and are available (ONLY APPROVED, not PENDING)
      const artworks = await this.prisma.artwork.findMany({
        where: {
          id: { in: artworkIds },
          status: "APPROVED", // Only allow APPROVED artworks
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

      // Check if all artworks were found
      if (artworks.length !== artworkIds.length) {
        const foundIds = artworks.map((a) => a.id);
        const missingIds = artworkIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `Some artworks are not available or not approved: ${missingIds.join(", ")}`
        );
      }

      // Check if user is trying to buy their own artwork
      const ownArtworks = artworks.filter(
        (artwork) => artwork.userId === userId
      );
      if (ownArtworks.length > 0) {
        throw new BadRequestException("You cannot purchase your own artwork");
      }

      // Double-check artworks are still available (not SOLD) - race condition protection
      const soldArtworks = artworks.filter(
        (artwork) => artwork.status === "SOLD"
      );
      if (soldArtworks.length > 0) {
        throw new BadRequestException(
          `Some artworks have been sold: ${soldArtworks.map((a) => a.id).join(", ")}`
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

      const platformFee = subtotal * this.PLATFORM_COMMISSION_RATE;
      const totalAmount = subtotal + platformFee;

      // Create order with transaction
      const order = await this.prisma.order.create({
        data: {
          buyerEmail: createOrderDto.buyerEmail,
          totalAmount: new Decimal(totalAmount),
          status: "PENDING",
          items: {
            create: orderItemsData,
          },
          transaction: {
            create: {
              amount: new Decimal(totalAmount),
              status: "INITIATED",
              metadata: {
                subtotal,
                platformFee,
                platformCommissionRate: this.PLATFORM_COMMISSION_RATE,
                shippingAddress: {
                  fullName: createOrderDto.shippingAddress.fullName,
                  phone: createOrderDto.shippingAddress.phone,
                  address: createOrderDto.shippingAddress.address,
                  city: createOrderDto.shippingAddress.city,
                  state: createOrderDto.shippingAddress.state,
                  zipCode: createOrderDto.shippingAddress.zipCode,
                  country: createOrderDto.shippingAddress.country,
                },
                paymentMethod: createOrderDto.paymentMethod,
                userId,
              } as Prisma.InputJsonValue,
            },
          },
        },
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
        items: (order as any).items.map((item: any) => ({
          artworkId: item.artworkId,
          artworkTitle: item.artwork.title,
          artistName: item.artwork.user.name,
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
   */
  async completeOrder(orderId: string, txRef: string, paymentProvider: string) {
    try {
      this.logger.log(`Completing order: ${orderId}`);

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

      if (order.status === "PAID") {
        this.logger.warn(`Order ${orderId} already paid`);
        return order;
      }

      // Update order and transaction
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          transaction: {
            update: {
              status: "COMPLETED",
              metadata: {
                ...(order.transaction.metadata as any),
                txRef,
                paymentProvider,
                completedAt: new Date().toISOString(),
              },
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

      // Mark artworks as SOLD (only if they're not already SOLD)
      const artworkIds = order.items.map((item) => item.artworkId);
      const updateResult = await this.prisma.artwork.updateMany({
        where: {
          id: { in: artworkIds },
          status: { not: "SOLD" }, // Only update if not already SOLD
        },
        data: { status: "SOLD" },
      });

      // Log if some artworks were already marked as SOLD
      if (updateResult.count < artworkIds.length) {
        this.logger.warn(
          `Some artworks were already marked as SOLD. Updated: ${updateResult.count}/${artworkIds.length}`
        );
      }

      // Calculate artist earnings and create withdrawal entries
      const metadata = order.transaction.metadata as any;
      const platformCommissionRate =
        metadata.platformCommissionRate || this.PLATFORM_COMMISSION_RATE;

      for (const item of order.items) {
        const itemPrice = Number(item.price) * item.quantity;
        const platformCommission = itemPrice * platformCommissionRate;
        const artistAmount = itemPrice - platformCommission;

        // Create a withdrawal entry for the artist (pending state)
        await this.prisma.withdrawal.create({
          data: {
            payoutAccount: item.artwork.iban || "NOT_SET",
            amount: new Decimal(artistAmount),
            status: "INITIATED", // Artist can request withdrawal later
          },
        });

        this.logger.log(
          `Created withdrawal for artist ${item.artwork.userId}: ${artistAmount} (Commission: ${platformCommission})`
        );
      }

      this.logger.log(`Order ${orderId} completed successfully`);

      return updatedOrder;
    } catch (error) {
      this.logger.error("Order completion failed:", error);
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
   * Get user's orders
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
                photos: true,
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
