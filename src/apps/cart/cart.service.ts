import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { CART_CONSTANTS, CART_MESSAGES } from './constants';
import { AddToCartDto, UpdateCartItemDto } from './dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add artwork to user's cart
   */
  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    try {
      const { artworkId, quantity = 1 } = addToCartDto;

      // Check if artwork exists
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!artwork) {
        throw new NotFoundException(CART_MESSAGES.ERROR.ARTWORK_NOT_FOUND);
      }

      // Prevent users from adding their own artwork to cart
      if (artwork.userId === userId) {
        throw new BadRequestException('You cannot add your own artwork to the cart');
      }

      // Prevent adding sold artworks to cart
      if (artwork.status === 'SOLD') {
        throw new BadRequestException('This artwork has been sold and is no longer available');
      }

      // Check if user has reached max cart items
      const cartItemsCount = await this.prisma.cartItem.count({
        where: { userId },
      });

      if (cartItemsCount >= CART_CONSTANTS.MAX_CART_ITEMS_PER_USER) {
        throw new BadRequestException(
          CART_MESSAGES.ERROR.MAX_CART_ITEMS_REACHED,
        );
      }

      // Check if item already exists in cart
      const existingCartItem = await this.prisma.cartItem.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      if (existingCartItem) {
        // Update quantity if item exists
        const newQuantity = existingCartItem.quantity + quantity;
        
        if (newQuantity > CART_CONSTANTS.MAX_QUANTITY_PER_ITEM) {
          throw new BadRequestException(CART_MESSAGES.ERROR.MAX_QUANTITY_REACHED);
        }

        const updatedItem = await this.prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: { quantity: newQuantity },
          include: {
            artwork: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    talentTypes: {
                      select: {
                        talentType: {
                          select: {
                            id: true,
                            name: true,
                            slug: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Format the response nicely
        const formattedItem = {
          ...updatedItem,
          artwork: {
            ...updatedItem.artwork,
            user: {
              ...updatedItem.artwork.user,
              talentTypes: updatedItem.artwork.user.talentTypes.map((tt) => ({
                id: tt.talentType.id,
                name: tt.talentType.name,
                slug: tt.talentType.slug,
              })),
            },
          },
        };

        this.logger.log(`✅ Cart item updated for user ${userId}`);
        return formattedItem;
      }

      // Create new cart item
      const cartItem = await this.prisma.cartItem.create({
        data: {
          userId,
          artworkId,
          quantity,
        },
        include: {
          artwork: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  talentTypes: {
                    select: {
                      talentType: {
                        select: {
                          id: true,
                          name: true,
                          slug: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Format the response nicely
      const formattedItem = {
        ...cartItem,
        artwork: {
          ...cartItem.artwork,
          user: {
            ...cartItem.artwork.user,
            talentTypes: cartItem.artwork.user.talentTypes.map((tt) => ({
              id: tt.talentType.id,
              name: tt.talentType.name,
              slug: tt.talentType.slug,
            })),
          },
        },
      };

      this.logger.log(`✅ Artwork ${artworkId} added to cart for user ${userId}`);
      return formattedItem;
    } catch (error) {
      this.logger.error(`❌ Failed to add to cart:`, error);
      throw error;
    }
  }

  /**
   * Get user's cart items with pagination
   * Excludes sold artworks from the cart
   * Automatically cleans up sold artworks before fetching
   */
  async getCartItems(userId: string, page: number = 1, limit: number = 10) {
    try {
      // Clean up sold artworks before fetching
      await this.cleanupSoldArtworks(userId);

      const skip = (page - 1) * limit;
      const take = Math.min(limit, CART_CONSTANTS.MAX_LIMIT);

      // Filter out sold artworks
      const [items, total] = await Promise.all([
        this.prisma.cartItem.findMany({
          where: {
            userId,
            artwork: {
              status: {
                not: 'SOLD',
              },
            },
          },
          skip,
          take,
          include: {
            artwork: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    talentTypes: {
                      select: {
                        talentType: {
                          select: {
                            id: true,
                            name: true,
                            slug: true,
                          },
                        },
                      },
                    },
                  },
                },
                _count: {
                  select: {
                    interactions: {
                      where: { type: 'LIKE' },
                    },
                    comments: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.cartItem.count({
          where: {
            userId,
            artwork: {
              status: {
                not: 'SOLD',
              },
            },
          },
        }),
      ]);

      // Calculate totals - only for non-sold artworks
      const allItems = await this.prisma.cartItem.findMany({
        where: {
          userId,
          artwork: {
            status: {
              not: 'SOLD',
            },
          },
        },
        include: {
          artwork: {
            select: {
              desiredPrice: true,
            },
          },
        },
      });

      const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = allItems.reduce(
        (sum, item) => sum + item.artwork.desiredPrice * item.quantity,
        0,
      );

      // Transform items to include artwork stats and format user data nicely
      const itemsWithStats = items.map((item) => ({
        ...item,
        artwork: {
          ...item.artwork,
          likeCount: item.artwork._count.interactions,
          commentCount: item.artwork._count.comments,
          user: {
            ...item.artwork.user,
            talentTypes: item.artwork.user.talentTypes.map((tt) => ({
              id: tt.talentType.id,
              name: tt.talentType.name,
              slug: tt.talentType.slug,
            })),
          },
          _count: undefined,
        },
      }));

      return {
        items: itemsWithStats,
        totalItems,
        totalPrice,
        pagination: {
          page,
          limit: take,
          total,
          pages: Math.ceil(total / take),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch cart items:`, error);
      throw error;
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string,
    artworkId: string,
    updateDto: UpdateCartItemDto,
  ) {
    try {
      const { quantity } = updateDto;

      // Check if cart item exists
      const cartItem = await this.prisma.cartItem.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      if (!cartItem) {
        throw new NotFoundException(CART_MESSAGES.ERROR.NOT_FOUND);
      }

      // Update quantity
      const updatedItem = await this.prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity },
        include: {
          artwork: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  talentTypes: {
                    select: {
                      talentType: {
                        select: {
                          id: true,
                          name: true,
                          slug: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Format the response nicely
      const formattedItem = {
        ...updatedItem,
        artwork: {
          ...updatedItem.artwork,
          user: {
            ...updatedItem.artwork.user,
            talentTypes: updatedItem.artwork.user.talentTypes.map((tt) => ({
              id: tt.talentType.id,
              name: tt.talentType.name,
              slug: tt.talentType.slug,
            })),
          },
        },
      };

      this.logger.log(`✅ Cart item updated for user ${userId}`);
      return formattedItem;
    } catch (error) {
      this.logger.error(`❌ Failed to update cart item:`, error);
      throw error;
    }
  }

  /**
   * Remove artwork from cart
   */
  async removeFromCart(userId: string, artworkId: string) {
    try {
      this.logger.log(`Attempting to remove artwork ${artworkId} from cart for user ${userId}`);

      // Check if cart item exists
      const cartItem = await this.prisma.cartItem.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      if (!cartItem) {
        this.logger.warn(`Cart item not found for userId: ${userId}, artworkId: ${artworkId}`);
        throw new NotFoundException(CART_MESSAGES.ERROR.NOT_FOUND);
      }

      // Remove from cart
      await this.prisma.cartItem.delete({
        where: {
          id: cartItem.id,
        },
      });

      this.logger.log(`✅ Artwork ${artworkId} removed from cart for user ${userId}`);
      return { success: true, message: CART_MESSAGES.SUCCESS.REMOVED };
    } catch (error) {
      this.logger.error(`❌ Failed to remove from cart:`, error);
      throw error;
    }
  }

  /**
   * Clear user's entire cart
   */
  async clearCart(userId: string) {
    try {
      await this.prisma.cartItem.deleteMany({
        where: { userId },
      });

      this.logger.log(`✅ Cart cleared for user ${userId}`);
      return { success: true, message: CART_MESSAGES.SUCCESS.CLEARED };
    } catch (error) {
      this.logger.error(`❌ Failed to clear cart:`, error);
      throw error;
    }
  }

  /**
   * Get cart summary (total items and total price)
   * Excludes sold artworks from the cart
   * Automatically cleans up sold artworks before calculating summary
   */
  async getCartSummary(userId: string) {
    try {
      // Clean up sold artworks before calculating summary
      await this.cleanupSoldArtworks(userId);

      // Filter out sold artworks
      const items = await this.prisma.cartItem.findMany({
        where: {
          userId,
          artwork: {
            status: {
              not: 'SOLD',
            },
          },
        },
        include: {
          artwork: {
            select: {
              desiredPrice: true,
            },
          },
        },
      });

      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = items.reduce(
        (sum, item) => sum + item.artwork.desiredPrice * item.quantity,
        0,
      );

      return {
        totalItems,
        totalPrice,
        itemCount: items.length, // Number of unique artworks (not quantities)
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get cart summary:`, error);
      throw error;
    }
  }

  /**
   * Clean up sold artworks from user's cart
   * This removes any cart items where the artwork status is SOLD
   */
  async cleanupSoldArtworks(userId: string) {
    try {
      const result = await this.prisma.cartItem.deleteMany({
        where: {
          userId,
          artwork: {
            status: 'SOLD',
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`✅ Cleaned up ${result.count} sold artwork(s) from cart for user ${userId}`);
      }

      return {
        removedCount: result.count,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to cleanup sold artworks from cart:`, error);
      throw error;
    }
  }
}

