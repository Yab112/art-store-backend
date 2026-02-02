import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { FAVORITE_CONSTANTS, FAVORITE_MESSAGES } from "./constants";

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add artwork to user's favorites
   */
  async addToFavorites(userId: string, artworkId: string) {
    try {
      // Check if artwork exists
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      });

      if (!artwork) {
        throw new NotFoundException(FAVORITE_MESSAGES.ERROR.ARTWORK_NOT_FOUND);
      }

      // Check if user has reached max favorites
      const favoritesCount = await this.prisma.favorite.count({
        where: { userId },
      });

      if (favoritesCount >= FAVORITE_CONSTANTS.MAX_FAVORITES_PER_USER) {
        throw new BadRequestException(
          FAVORITE_MESSAGES.ERROR.MAX_FAVORITES_REACHED,
        );
      }

      // Check if already in favorites
      const existingFavorite = await this.prisma.favorite.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      if (existingFavorite) {
        throw new BadRequestException(FAVORITE_MESSAGES.ERROR.ALREADY_EXISTS);
      }

      // Add to favorites
      const favorite = await this.prisma.favorite.create({
        data: {
          userId,
          artworkId,
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
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `✅ Artwork ${artworkId} added to favorites for user ${userId}`,
      );
      return favorite;
    } catch (error) {
      this.logger.error(`❌ Failed to add favorite:`, error);
      throw error;
    }
  }

  /**
   * Remove artwork from user's favorites
   */
  async removeFromFavorites(userId: string, artworkId: string) {
    try {
      // Check if favorite exists
      const favorite = await this.prisma.favorite.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      if (!favorite) {
        throw new NotFoundException(FAVORITE_MESSAGES.ERROR.NOT_FOUND);
      }

      // Remove from favorites
      await this.prisma.favorite.delete({
        where: {
          id: favorite.id,
        },
      });

      this.logger.log(
        `✅ Artwork ${artworkId} removed from favorites for user ${userId}`,
      );
      return { success: true, message: FAVORITE_MESSAGES.SUCCESS.REMOVED };
    } catch (error) {
      this.logger.error(`❌ Failed to remove favorite:`, error);
      throw error;
    }
  }

  /**
   * Get all user's favorites with pagination
   */
  async getUserFavorites(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      const take = Math.min(limit, FAVORITE_CONSTANTS.MAX_LIMIT);

      const [favorites, total] = await Promise.all([
        this.prisma.favorite.findMany({
          where: { userId },
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
                  },
                },
                _count: {
                  select: {
                    interactions: {
                      where: { type: "LIKE" },
                    },
                    comments: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.favorite.count({
          where: { userId },
        }),
      ]);

      // Transform favorites to include artwork stats
      const favoritesWithStats = favorites.map((favorite) => ({
        ...favorite,
        artwork: {
          ...favorite.artwork,
          likeCount: favorite.artwork._count.interactions,
          commentCount: favorite.artwork._count.comments,
          _count: undefined,
        },
      }));

      return {
        favorites: favoritesWithStats,
        pagination: {
          page,
          limit: take,
          total,
          pages: Math.ceil(total / take),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch favorites:`, error);
      throw error;
    }
  }

  /**
   * Check if artwork is in user's favorites
   */
  async isFavorite(userId: string, artworkId: string): Promise<boolean> {
    try {
      const favorite = await this.prisma.favorite.findUnique({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      });

      return !!favorite;
    } catch (error) {
      this.logger.error(`❌ Failed to check favorite:`, error);
      return false;
    }
  }

  /**
   * Get favorites count for user
   */
  async getFavoritesCount(userId: string): Promise<number> {
    try {
      return await this.prisma.favorite.count({
        where: { userId },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to get favorites count:`, error);
      return 0;
    }
  }
}
