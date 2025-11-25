import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class ArtistService {
  private readonly logger = new Logger(ArtistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService
  ) {}

  /**
   * Get artist earnings statistics
   */
  async getEarningsStats(userId: string) {
    try {
      // Get all sold artworks by this artist
      const soldArtworks = await this.prisma.artwork.findMany({
        where: {
          userId,
          status: "SOLD",
        },
        include: {
          orderItems: {
            include: {
              order: {
                include: {
                  transaction: true,
                },
              },
            },
          },
        },
      });

      // Calculate total sales, earnings, and commission
      const platformCommissionRate =
        await this.settingsService.getPlatformCommissionRate();
      let totalSales = 0;
      let totalCommission = 0;
      let totalEarnings = 0;
      let salesCount = 0;

      const sales = [];

      for (const artwork of soldArtworks) {
        for (const orderItem of artwork.orderItems) {
          if (orderItem.order.status === "PAID") {
            const salePrice = Number(orderItem.price);
            const commission = salePrice * platformCommissionRate;
            const earnings = salePrice - commission;

            totalSales += salePrice;
            totalCommission += commission;
            totalEarnings += earnings;
            salesCount++;

            sales.push({
              artworkId: artwork.id,
              artworkTitle: artwork.title,
              artworkImage: artwork.photos[0],
              salePrice,
              commission,
              earnings,
              soldAt: orderItem.order.createdAt,
              buyerEmail: orderItem.order.buyerEmail,
            });
          }
        }
      }

      // Get total withdrawn amount
      const withdrawals = await this.prisma.withdrawal.findMany({
        where: {
          payoutAccount: {
            in: soldArtworks.map((a) => a.iban),
          },
          status: "COMPLETED",
        },
      });

      const totalWithdrawn = withdrawals.reduce(
        (sum, w) => sum + Number(w.amount),
        0
      );

      // Calculate available balance
      const availableBalance = totalEarnings - totalWithdrawn;

      return {
        success: true,
        data: {
          totalSales,
          totalCommission,
          totalEarnings,
          totalWithdrawn,
          availableBalance,
          salesCount,
          sales: sales.sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime()),
        },
      };
    } catch (error) {
      this.logger.error("Failed to get earnings stats:", error);
      throw error;
    }
  }

  /**
   * Get withdrawal history for artist
   */
  async getWithdrawalHistory(userId: string) {
    try {
      // Get all artworks by this artist to find their IBANs
      const artworks = await this.prisma.artwork.findMany({
        where: { userId },
        select: { iban: true },
      });

      const ibans = [...new Set(artworks.map((a) => a.iban))];

      // Get withdrawals for those IBANs
      const withdrawals = await this.prisma.withdrawal.findMany({
        where: {
          payoutAccount: {
            in: ibans,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        success: true,
        data: withdrawals.map((w) => ({
          id: w.id,
          amount: Number(w.amount),
          status: w.status,
          payoutAccount: w.payoutAccount,
          createdAt: w.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error("Failed to get withdrawal history:", error);
      throw error;
    }
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(userId: string, amount: number, iban: string) {
    try {
      // Verify the IBAN belongs to this artist
      const artwork = await this.prisma.artwork.findFirst({
        where: {
          userId,
          iban,
        },
      });

      if (!artwork) {
        throw new NotFoundException(
          "Payment account not found or does not belong to you"
        );
      }

      // Get earnings stats to check available balance
      const stats = await this.getEarningsStats(userId);
      const availableBalance = stats.data.availableBalance;

      if (amount > availableBalance) {
        throw new Error(
          `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
        );
      }

      // Get payment settings from settings
      const paymentSettings =
        await this.settingsService.getPaymentSettingsValues();
      if (amount < paymentSettings.minWithdrawalAmount) {
        throw new Error(
          `Minimum withdrawal amount is $${paymentSettings.minWithdrawalAmount}`
        );
      }

      // Check maximum withdrawal amount (0 = unlimited)
      if (
        paymentSettings.maxWithdrawalAmount > 0 &&
        amount > paymentSettings.maxWithdrawalAmount
      ) {
        throw new Error(
          `Maximum withdrawal amount is $${paymentSettings.maxWithdrawalAmount}`
        );
      }

      // Create withdrawal request
      const withdrawal = await this.prisma.withdrawal.create({
        data: {
          userId,
          payoutAccount: iban,
          amount: new Decimal(amount),
          status: "INITIATED",
        } as any,
      });

      this.logger.log(
        `Withdrawal request created: ${withdrawal.id} for user ${userId}`
      );

      return {
        success: true,
        message: "Withdrawal request submitted successfully",
        data: {
          id: withdrawal.id,
          amount: Number(withdrawal.amount),
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
        },
      };
    } catch (error) {
      this.logger.error("Failed to request withdrawal:", error);
      throw error;
    }
  }

  /**
   * Get artist's payment methods
   */
  async getPaymentMethods(userId: string) {
    try {
      const artworks = await this.prisma.artwork.findMany({
        where: { userId },
        select: {
          id: true,
          accountHolder: true,
          iban: true,
          bicCode: true,
        },
        distinct: ["iban"],
      });

      // Group by IBAN to avoid duplicates
      const uniquePaymentMethods = artworks.reduce((acc, artwork) => {
        if (!acc.find((pm) => pm.iban === artwork.iban)) {
          acc.push({
            accountHolder: artwork.accountHolder,
            iban: artwork.iban,
            bicCode: artwork.bicCode,
          });
        }
        return acc;
      }, []);

      return {
        success: true,
        data: uniquePaymentMethods,
      };
    } catch (error) {
      this.logger.error("Failed to get payment methods:", error);
      throw error;
    }
  }

  /**
   * Update default payment method
   * This updates all artworks from the artist to use the new payment info
   */
  async updatePaymentMethod(
    userId: string,
    accountHolder: string,
    iban: string,
    bicCode?: string
  ) {
    try {
      // Update all artworks by this user
      const result = await this.prisma.artwork.updateMany({
        where: { userId },
        data: {
          accountHolder,
          iban,
          bicCode: bicCode || null,
        },
      });

      this.logger.log(
        `Updated payment method for ${result.count} artworks for user ${userId}`
      );

      return {
        success: true,
        message: "Payment method updated successfully",
        data: {
          artworksUpdated: result.count,
        },
      };
    } catch (error) {
      this.logger.error("Failed to update payment method:", error);
      throw error;
    }
  }

  /**
   * Get all artists with pagination and search
   */
  async getAllArtists(page: number = 1, limit: number = 50, search?: string) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        banned: false,
        artworks: {
          some: {
            status: "APPROVED",
          },
        },
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get artists with their artwork counts
      const [artists, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            image: true,
            location: true,
            profileViews: true,
            heatScore: true,
            lastActiveAt: true,
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
            _count: {
              select: {
                artworks: {
                  where: {
                    status: "APPROVED",
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      // Get sales and views for each artist
      const artistsWithStats = await Promise.all(
        artists.map(async (artist) => {
          const artworks = await this.prisma.artwork.findMany({
            where: {
              userId: artist.id,
              status: "APPROVED",
            },
            select: {
              id: true,
              orderItems: {
                where: {
                  order: {
                    status: "PAID",
                  },
                },
                select: {
                  price: true,
                },
              },
            },
          });

          // Get views from interactions
          const views = await this.prisma.interaction.count({
            where: {
              artwork: {
                userId: artist.id,
                status: "APPROVED",
              },
              type: "view",
            },
          });

          const sales = artworks.reduce(
            (sum, artwork) =>
              sum +
              artwork.orderItems.reduce(
                (itemSum, item) => itemSum + Number(item.price),
                0
              ),
            0
          );

          const salesCount = artworks.filter(
            (a) => a.orderItems.length > 0
          ).length;

          return {
            id: artist.id,
            name: artist.name,
            avatar: artist.image || "",
            artworks: artist._count.artworks,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: artist.location || "",
            profileViews: artist.profileViews || 0,
            heatScore: artist.heatScore || 0,
            lastActiveAt: artist.lastActiveAt,
            talentTypes: artist.talentTypes?.map((ut) => ut.talentType) || [],
          };
        })
      );

      return {
        success: true,
        artists: artistsWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Failed to get all artists:", error);
      throw error;
    }
  }

  /**
   * Get top selling artists
   */
  async getTopSellingArtists(limit: number = 10) {
    try {
      // Get all users with approved artworks
      const users = await this.prisma.user.findMany({
        where: {
          banned: false,
          artworks: {
            some: {
              status: "APPROVED",
            },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          location: true,
          artworks: {
            where: {
              status: "APPROVED",
            },
            select: {
              id: true,
              orderItems: {
                where: {
                  order: {
                    status: "PAID",
                  },
                },
                select: {
                  price: true,
                },
              },
            },
          },
        },
      });

      // Calculate stats for each artist
      const artistsWithStats = await Promise.all(
        users.map(async (user) => {
          const sales = user.artworks.reduce(
            (sum, artwork) =>
              sum +
              artwork.orderItems.reduce(
                (itemSum, item) => itemSum + Number(item.price),
                0
              ),
            0
          );

          const salesCount = user.artworks.filter(
            (a) => a.orderItems.length > 0
          ).length;

          // Get views from interactions
          const views = await this.prisma.interaction.count({
            where: {
              artwork: {
                userId: user.id,
                status: "APPROVED",
              },
              type: "view",
            },
          });

          return {
            id: user.id,
            name: user.name,
            avatar: user.image || "",
            artworks: user.artworks.length,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: user.location || "",
          };
        })
      );

      return {
        success: true,
        artists: artistsWithStats
          .filter((artist) => artist.sales > 0)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, limit),
      };
    } catch (error) {
      this.logger.error("Failed to get top selling artists:", error);
      throw error;
    }
  }

  /**
   * Get most viewed artists
   */
  async getMostViewedArtists(limit: number = 10) {
    try {
      // Get all users with approved artworks
      const users = await this.prisma.user.findMany({
        where: {
          banned: false,
          artworks: {
            some: {
              status: "APPROVED",
            },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          location: true,
          artworks: {
            where: {
              status: "APPROVED",
            },
            select: {
              id: true,
              orderItems: {
                where: {
                  order: {
                    status: "PAID",
                  },
                },
                select: {
                  price: true,
                },
              },
            },
          },
        },
      });

      // Calculate stats for each artist
      const artistsWithStats = await Promise.all(
        users.map(async (user) => {
          // Get views from interactions
          const views = await this.prisma.interaction.count({
            where: {
              artwork: {
                userId: user.id,
                status: "APPROVED",
              },
              type: "view",
            },
          });

          const sales = user.artworks.reduce(
            (sum, artwork) =>
              sum +
              artwork.orderItems.reduce(
                (itemSum, item) => itemSum + Number(item.price),
                0
              ),
            0
          );

          return {
            id: user.id,
            name: user.name,
            avatar: user.image || "",
            artworks: user.artworks.length,
            sales: sales,
            views: views,
            country: user.location || "",
          };
        })
      );

      return {
        success: true,
        artists: artistsWithStats
          .filter((artist) => artist.views > 0)
          .sort((a, b) => b.views - a.views)
          .slice(0, limit),
      };
    } catch (error) {
      this.logger.error("Failed to get most viewed artists:", error);
      throw error;
    }
  }

  /**
   * Get similar artists based on categories/techniques
   */
  async getSimilarArtists(artistId: string, limit: number = 6) {
    try {
      // Get the artist's artworks and their categories
      const artistArtworks = await this.prisma.artwork.findMany({
        where: {
          userId: artistId,
          status: "APPROVED",
        },
        select: {
          categories: {
            select: {
              categoryId: true,
            },
          },
        },
      });

      // Extract unique category IDs
      const categoryIds = [
        ...new Set(
          artistArtworks.flatMap((a) => a.categories.map((c) => c.categoryId))
        ),
      ];

      if (categoryIds.length === 0) {
        // If no categories/techniques, return random artists
        const artists = await this.prisma.user.findMany({
          where: {
            id: { not: artistId },
            banned: false,
            artworks: {
              some: {
                status: "APPROVED",
              },
            },
          },
          take: limit,
          select: {
            id: true,
            name: true,
            image: true,
            location: true,
            artworks: {
              where: {
                status: "APPROVED",
              },
              select: {
                id: true,
                orderItems: {
                  where: {
                    order: {
                      status: "PAID",
                    },
                  },
                  select: {
                    price: true,
                  },
                },
              },
            },
          },
        });

        const artistsWithStats = await Promise.all(
          artists.map(async (user) => {
            // Get views from interactions
            const views = await this.prisma.interaction.count({
              where: {
                artwork: {
                  userId: user.id,
                  status: "APPROVED",
                },
                type: "view",
              },
            });

            const sales = user.artworks.reduce(
              (sum, artwork) =>
                sum +
                artwork.orderItems.reduce(
                  (itemSum, item) => itemSum + Number(item.price),
                  0
                ),
              0
            );

            return {
              id: user.id,
              name: user.name,
              avatar: user.image || "",
              artworks: user.artworks.length,
              sales: sales,
              views: views,
            };
          })
        );

        return {
          success: true,
          artists: artistsWithStats,
        };
      }

      // Find artists with similar categories
      const similarArtists = await this.prisma.user.findMany({
        where: {
          id: { not: artistId },
          banned: false,
          artworks: {
            some: {
              status: "APPROVED",
              categories: {
                some: {
                  categoryId: { in: categoryIds },
                },
              },
            },
          },
        },
        take: limit * 2, // Get more to filter and sort
        select: {
          id: true,
          name: true,
          image: true,
          artworks: {
            where: {
              status: "APPROVED",
            },
            select: {
              id: true,
              orderItems: {
                where: {
                  order: {
                    status: "PAID",
                  },
                },
                select: {
                  price: true,
                },
              },
            },
          },
        },
      });

      // Calculate stats and sort
      const artistsWithStats = await Promise.all(
        similarArtists.map(async (user) => {
          // Get views from interactions
          const views = await this.prisma.interaction.count({
            where: {
              artwork: {
                userId: user.id,
                status: "APPROVED",
              },
              type: "view",
            },
          });

          const sales = user.artworks.reduce(
            (sum, artwork) =>
              sum +
              artwork.orderItems.reduce(
                (itemSum, item) => itemSum + Number(item.price),
                0
              ),
            0
          );

          return {
            id: user.id,
            name: user.name,
            avatar: user.image || "",
            artworks: user.artworks.length,
            sales: sales,
            views: views,
          };
        })
      );

      return {
        success: true,
        artists: artistsWithStats
          .sort((a, b) => b.views - a.views)
          .slice(0, limit),
      };
    } catch (error) {
      this.logger.error("Failed to get similar artists:", error);
      throw error;
    }
  }

  /**
   * Get trending artists (high heatScore)
   */
  async getTrendingArtists(limit: number = 10, talentTypeId?: string) {
    try {
      const where: any = {
        banned: false,
        heatScore: { gt: 0 },
        artworks: {
          some: {
            status: "APPROVED",
          },
        },
      };

      if (talentTypeId) {
        where.talentTypes = {
          some: {
            talentTypeId,
          },
        };
      }

      const artists = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          image: true,
          coverImage: true,
          location: true,
          bio: true,
          profileViews: true,
          heatScore: true,
          lastActiveAt: true,
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
          _count: {
            select: {
              artworks: {
                where: {
                  status: "APPROVED",
                },
              },
            },
          },
        },
        orderBy: {
          heatScore: "desc",
        },
        take: limit,
      });

      return {
        success: true,
        artists: artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          avatar: artist.image || "",
          coverImage: artist.coverImage,
          location: artist.location || "",
          bio: artist.bio,
          profileViews: artist.profileViews || 0,
          heatScore: artist.heatScore || 0,
          lastActiveAt: artist.lastActiveAt,
          talentTypes: artist.talentTypes?.map((ut) => ut.talentType) || [],
          artworkCount: artist._count.artworks,
        })),
      };
    } catch (error) {
      this.logger.error("Failed to get trending artists:", error);
      throw error;
    }
  }

  /**
   * Get online artists (recently active)
   */
  async getOnlineArtists(limit: number = 20) {
    try {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const artists = await this.prisma.user.findMany({
        where: {
          banned: false,
          lastActiveAt: {
            gte: fiveMinutesAgo,
          },
          artworks: {
            some: {
              status: "APPROVED",
            },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          coverImage: true,
          location: true,
          bio: true,
          profileViews: true,
          heatScore: true,
          lastActiveAt: true,
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
          _count: {
            select: {
              artworks: {
                where: {
                  status: "APPROVED",
                },
              },
            },
          },
        },
        orderBy: {
          lastActiveAt: "desc",
        },
        take: limit,
      });

      return {
        success: true,
        artists: artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          avatar: artist.image || "",
          coverImage: artist.coverImage,
          location: artist.location || "",
          bio: artist.bio,
          profileViews: artist.profileViews || 0,
          heatScore: artist.heatScore || 0,
          lastActiveAt: artist.lastActiveAt,
          talentTypes: artist.talentTypes?.map((ut) => ut.talentType) || [],
          artworkCount: artist._count.artworks,
        })),
      };
    } catch (error) {
      this.logger.error("Failed to get online artists:", error);
      throw error;
    }
  }

  /**
   * Get artists by talent type
   */
  async getArtistsByTalentType(
    talentTypeId: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const skip = (page - 1) * limit;

      const [artists, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            talentTypes: {
              some: {
                talentTypeId,
              },
            },
            banned: false,
            artworks: {
              some: {
                status: "APPROVED",
              },
            },
          },
          select: {
            id: true,
            name: true,
            image: true,
            coverImage: true,
            location: true,
            bio: true,
            profileViews: true,
            heatScore: true,
            lastActiveAt: true,
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
            _count: {
              select: {
                artworks: {
                  where: {
                    status: "APPROVED",
                  },
                },
              },
            },
          },
          orderBy: {
            heatScore: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.user.count({
          where: {
            talentTypes: {
              some: {
                talentTypeId,
              },
            },
            banned: false,
            artworks: {
              some: {
                status: "APPROVED",
              },
            },
          },
        }),
      ]);

      return {
        success: true,
        data: {
          artists: artists.map((artist) => ({
            id: artist.id,
            name: artist.name,
            avatar: artist.image || "",
            coverImage: artist.coverImage,
            location: artist.location || "",
            bio: artist.bio,
            profileViews: artist.profileViews || 0,
            heatScore: artist.heatScore || 0,
            lastActiveAt: artist.lastActiveAt,
            talentTypes: artist.talentTypes?.map((ut) => ut.talentType) || [],
            artworkCount: artist._count.artworks,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get artists by talent type ${talentTypeId}:`,
        error
      );
      throw error;
    }
  }
}
