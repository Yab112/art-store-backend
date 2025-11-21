import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly PLATFORM_COMMISSION_RATE = 0.10; // 10% commission

  constructor(private prisma: PrismaService) {}

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
      this.logger.log(`Creating order for user: ${userId}`);

      // Validate artworks exist and are available
      const artworkIds = createOrderDto.items.map((item) => item.artworkId);
      const artworks = await this.prisma.artwork.findMany({
        where: {
          id: { in: artworkIds },
          status: { in: ['APPROVED', 'PENDING'] },
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
        throw new BadRequestException('Some artworks are not available');
      }

      // Prevent users from purchasing their own artwork
      const ownArtworks = artworks.filter((artwork) => artwork.userId === userId);
      if (ownArtworks.length > 0) {
        const artworkTitles = ownArtworks.map((a) => a.title || a.id).join(', ');
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

      const platformFee = subtotal * this.PLATFORM_COMMISSION_RATE;
      const totalAmount = subtotal + platformFee;

      // Create order with transaction
      const order = await this.prisma.order.create({
        data: {
          buyerEmail: createOrderDto.buyerEmail,
          totalAmount: new Decimal(totalAmount),
          status: 'PENDING',
          items: {
            create: orderItemsData,
          },
          transaction: {
            create: {
              amount: new Decimal(totalAmount),
              status: 'INITIATED',
              metadata: JSON.parse(JSON.stringify({
                subtotal,
                platformFee,
                platformCommissionRate: this.PLATFORM_COMMISSION_RATE,
                shippingAddress: createOrderDto.shippingAddress,
                paymentMethod: createOrderDto.paymentMethod,
                userId,
              })),
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
        items: (order.items || []).map((item: any) => ({
          artworkId: item.artworkId,
          artworkTitle: item.artwork?.title,
          artistName: item.artwork?.user?.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
      };
    } catch (error) {
      this.logger.error('Order creation failed:', error);
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
        throw new NotFoundException('Order not found');
      }

      if (order.status === 'PAID') {
        this.logger.warn(`Order ${orderId} already paid`);
        return order;
      }

      // Update order and transaction
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          transaction: {
            update: {
              status: 'COMPLETED',
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

      // Mark artworks as SOLD
      const artworkIds = order.items.map((item) => item.artworkId);
      await this.prisma.artwork.updateMany({
        where: { id: { in: artworkIds } },
        data: { status: 'SOLD' },
      });

      // Calculate artist earnings and create withdrawal entries
      const metadata = order.transaction.metadata as any;
      const platformCommissionRate = metadata.platformCommissionRate || this.PLATFORM_COMMISSION_RATE;

      for (const item of order.items) {
        const itemPrice = Number(item.price) * item.quantity;
        const platformCommission = itemPrice * platformCommissionRate;
        const artistAmount = itemPrice - platformCommission;

        // Create a withdrawal entry for the artist (pending state)
        await this.prisma.withdrawal.create({
          data: {
            payoutAccount: item.artwork.iban || 'NOT_SET',
            amount: new Decimal(artistAmount),
            status: 'INITIATED', // Artist can request withdrawal later
          },
        });

        this.logger.log(
          `Created withdrawal for artist ${item.artwork.userId}: ${artistAmount} (Commission: ${platformCommission})`,
        );
      }

      this.logger.log(`Order ${orderId} completed successfully`);

      return updatedOrder;
    } catch (error) {
      this.logger.error('Order completion failed:', error);
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
      throw new NotFoundException('Order not found');
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
      orderBy: { createdAt: 'desc' },
    });
  }
}
