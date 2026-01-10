import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
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
   * Returns comprehensive earnings data including sales, commissions, and withdrawals
   * Uses user.earning as the source of truth for total earnings
   */
  async getEarningsStats(userId: string) {
    try {
      this.logger.log(`[EARNINGS] Getting earnings for user: ${userId}`);
      
      // Get the user and their earning field (source of truth)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          earning: true,
        },
      });

      if (!user) {
        this.logger.error(`[EARNINGS] User not found: ${userId}`);
        throw new NotFoundException("User not found");
      }

      // Total earnings from user table (source of truth)
      const totalEarnings = Number(user.earning || 0);
      
      // Get all withdrawals for this user
      const allWithdrawals = await this.prisma.withdrawal.findMany({
        where: {
          userId: userId,
        },
      });

      // Calculate total withdrawn (COMPLETED withdrawals)
      const totalWithdrawn = allWithdrawals
        .filter(w => w.status === "COMPLETED")
        .reduce((sum, w) => sum + Number(w.amount), 0);

      // Available balance = total earnings - total withdrawn
      const availableBalance = Math.max(0, totalEarnings - totalWithdrawn);

      // Get all order items for artworks sold by this artist (orders with status PAID)
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          artwork: {
            userId: userId,
          },
          order: {
            status: "PAID",
          },
        },
        include: {
          artwork: {
            select: {
              id: true,
              title: true,
              photos: true,
            },
          },
          order: {
            select: {
              id: true,
              buyerEmail: true,
              createdAt: true,
              totalAmount: true,
              platformEarning: {
                select: {
                  amount: true,
                  commissionRate: true,
                },
              },
              items: {
                select: {
                  price: true,
                  quantity: true,
                },
              },
            },
          },
        },
        orderBy: {
          order: {
            createdAt: 'desc',
          },
        },
      });

      // Calculate total sales and commission from order items
      let totalSales = 0;
      let totalCommission = 0;
      const sales: Array<{
        artworkId: string;
        artworkTitle: string;
        artworkImage: string;
        salePrice: number;
        commission: number;
        earnings: number;
        soldAt: string;
        buyerEmail: string;
      }> = [];

      // Get platform commission rate (default fallback)
      const platformCommissionRate = await this.settingsService.getPlatformCommissionRate();

      for (const item of orderItems) {
        const salePrice = Number(item.price) * item.quantity;
        totalSales += salePrice;

        // Calculate commission - prefer from PlatformEarning if available, otherwise calculate
        let commission = 0;
        if (item.order.platformEarning) {
          // Calculate total order value from all items
          const totalOrderValue = item.order.items.reduce(
            (sum, orderItem) => sum + (Number(orderItem.price) * orderItem.quantity),
            0
          );
          
          // Calculate this item's proportion of the order
          const itemProportion = totalOrderValue > 0 ? salePrice / totalOrderValue : 0;
          
          // Apply proportion to platform earning
          commission = Number(item.order.platformEarning.amount) * itemProportion;
        } else {
          // Fallback: calculate commission using default rate
          commission = salePrice * platformCommissionRate;
        }
        totalCommission += commission;

        const earnings = salePrice - commission;

        // Get artwork image (first photo or placeholder)
        const artworkImage = item.artwork.photos && item.artwork.photos.length > 0
          ? item.artwork.photos[0]
          : '';

        sales.push({
          artworkId: item.artwork.id,
          artworkTitle: item.artwork.title || 'Untitled',
          artworkImage: artworkImage,
          salePrice: salePrice,
          commission: commission,
          earnings: earnings,
          soldAt: item.order.createdAt.toISOString(),
          buyerEmail: item.order.buyerEmail,
        });
      }

      // Get unique order count (sales count)
      const uniqueOrderIds = new Set(orderItems.map(item => item.order.id));
      const salesCount = uniqueOrderIds.size;
      
      this.logger.log(
        `[EARNINGS] User ${userId} - ` +
        `Total Earnings: ${totalEarnings}, ` +
        `Total Sales: ${totalSales}, ` +
        `Total Commission: ${totalCommission}, ` +
        `Total Withdrawn: ${totalWithdrawn}, ` +
        `Available Balance: ${availableBalance}, ` +
        `Sales Count: ${salesCount}`
      );

      return {
        success: true,
        data: {
          // Core earnings metrics (using user.earning as source of truth)
          earning: totalEarnings, // Total earnings from user table
          totalEarnings: totalEarnings, // Alias for compatibility
          totalSales: totalSales,
          totalCommission: totalCommission,
          
          // Withdrawal metrics
          totalWithdrawn: totalWithdrawn,
          
          // Available balance (what can be withdrawn now)
          availableBalance: availableBalance,
          
          // Sales data
          salesCount: salesCount,
          sales: sales,
        },
      };
    } catch (error) {
      this.logger.error("[EARNINGS] Failed to get earnings:", error);
      throw error;
    }
  }

  /**
   * Get withdrawal history for artist with pagination
   */
  async getWithdrawalHistory(userId: string, page: number = 1, limit: number = 20) {
    try {
      // Get all artworks by this artist to find their IBANs
      const artworks = await this.prisma.artwork.findMany({
        where: { userId },
        select: { iban: true },
      });

      const ibans = [...new Set(artworks.map((a) => a.iban).filter(Boolean))];

      // If no IBANs, return empty result
      if (ibans.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        };
      }

      const skip = (page - 1) * limit;

      // Get withdrawals for those IBANs with pagination
      const [withdrawals, total] = await Promise.all([
        this.prisma.withdrawal.findMany({
        where: {
          payoutAccount: {
            in: ibans,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
          skip,
          take: limit,
        }),
        this.prisma.withdrawal.count({
          where: {
            payoutAccount: {
              in: ibans,
            },
          },
        }),
      ]);

      return {
        success: true,
        data: withdrawals.map((w: any) => {
          // Extract rejection reason from metadata if status is REJECTED or FAILED
          let rejectionReason = null;
          let paypalStatus = null;
          
          if (w.metadata) {
            const metadata = w.metadata as any;
            if ((w.status === 'REJECTED' || w.status === 'FAILED')) {
              rejectionReason = metadata.rejectionReason || null;
            }
            // Get PayPal transaction status from webhook (actual status from PayPal)
            paypalStatus = metadata.webhookTransactionStatus || metadata.paypalItemStatus || null;
          }

          return {
            id: w.id,
            amount: Number(w.amount),
            status: w.status, // System status (PROCESSING, INITIATED, etc.)
            paypalStatus, // Actual PayPal transaction status (SUCCESS, UNCLAIMED, etc.)
            payoutAccount: w.payoutAccount,
            createdAt: w.createdAt,
            rejectionReason,
          };
        }),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Failed to get withdrawal history:", error);
      throw error;
    }
  }

  /**
   * Request withdrawal with comprehensive backend validations
   * All validations must pass before request enters admin review
   */
  async requestWithdrawal(userId: string, amount: number, iban: string) {
    try {
      // ============================================
      // BACKEND VALIDATIONS (AUTOMATIC) - FIRST
      // ============================================
      
      // 1. Verify the IBAN belongs to this artist
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

      // 2. Check if artist is verified (email verified)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true, email: true, banned: true },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (!user.emailVerified) {
        throw new BadRequestException(
          "Your email must be verified before requesting withdrawals. Please verify your email address."
        );
      }

      // 3. Check if user is banned
      if (user.banned) {
        throw new BadRequestException(
          "Your account has been banned. Withdrawal requests are not allowed."
        );
      }

      // 4. Check for active disputes
      const activeDisputes = await this.prisma.dispute.findMany({
        where: {
          targetUserId: userId,
          status: "IN_PROGRESS",
        },
      });

      if (activeDisputes.length > 0) {
        throw new BadRequestException(
          `You have ${activeDisputes.length} active dispute(s). Please resolve all disputes before requesting withdrawals.`
        );
      }

      // 5. Check balance is sufficient
      const stats = await this.getEarningsStats(userId);
      const availableBalance = stats.data.availableBalance;

      if (amount > availableBalance) {
        throw new BadRequestException(
          `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`
        );
      }

      // 6. Check minimum withdrawal amount
      const paymentSettings =
        await this.settingsService.getPaymentSettingsValues();
      
      if (amount < paymentSettings.minWithdrawalAmount) {
        throw new BadRequestException(
          `Minimum withdrawal amount is $${paymentSettings.minWithdrawalAmount}`
        );
      }

      // 7. Check maximum withdrawal amount (0 = unlimited)
      if (
        paymentSettings.maxWithdrawalAmount > 0 &&
        amount > paymentSettings.maxWithdrawalAmount
      ) {
        throw new BadRequestException(
          `Maximum withdrawal amount is $${paymentSettings.maxWithdrawalAmount}`
        );
      }

      // 8. Check for any pending withdrawals (INITIATED or PROCESSING states)
      // User can only request a new withdrawal if all previous withdrawals are COMPLETED, REJECTED, FAILED, or REFUNDED
      const pendingWithdrawals = await this.prisma.withdrawal.findMany({
        where: {
          userId,
          status: {
            in: ["INITIATED", "PROCESSING"], // Check for any pending/active withdrawals
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (pendingWithdrawals.length > 0) {
        const pendingCount = pendingWithdrawals.length;
        const totalPendingAmount = pendingWithdrawals.reduce(
          (sum, w) => sum + Number(w.amount),
          0
        );
        const statuses = [...new Set(pendingWithdrawals.map(w => w.status))].join(" and ");
        
        // Create a more informative error message
        const withdrawalDetails = pendingWithdrawals
          .map((w, idx) => `$${Number(w.amount).toFixed(2)} (${w.status})`)
          .join(", ");
        
        throw new BadRequestException(
          `You have ${pendingCount} pending withdrawal request${pendingCount > 1 ? 's' : ''} totaling $${totalPendingAmount.toFixed(2)} with status: ${statuses}. ` +
          `Please wait until all pending withdrawals are completed or rejected before requesting a new withdrawal. ` +
          `Pending: ${withdrawalDetails}`
        );
      }

      // 10. PayPal email validation (if using PayPal for payouts)
      // For now, we'll validate that the email format is valid
      // In production, you might want to check if the email is a valid PayPal account
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (user.email && !emailRegex.test(user.email)) {
        throw new BadRequestException("Invalid email format. Please update your email address.");
      }

      // All validations passed - create withdrawal request
      // Status: INITIATED (enters admin review queue)
      const withdrawal = await this.prisma.withdrawal.create({
        data: {
          userId,
          payoutAccount: iban,
          amount: new Decimal(amount),
          status: "INITIATED", // Admin will review and approve/reject
        } as any,
      });

      this.logger.log(
        `✅ Withdrawal request created (passed all validations): ${withdrawal.id} for user ${userId}, amount: $${amount}`
      );

      return {
        success: true,
        message: "Withdrawal request submitted successfully and is pending admin approval",
        data: {
          id: withdrawal.id,
          amount: Number(withdrawal.amount),
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
        },
      };
    } catch (error) {
      this.logger.error("❌ Withdrawal request validation failed:", error);
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
  async getAllArtists(
    page: number = 1,
    limit: number = 50,
    search?: string,
    country?: string,
    talentTypeId?: string,
    email?: string
  ) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        banned: false,
        // artworks: {
        //   some: {
        //     status: "APPROVED",
        //   },
        // },
      };

      // Filter by country (location field)
      if (country && country.trim() !== "") {
        where.location = {
          contains: country,
          mode: "insensitive",
        };
      }

      // Filter by talent type
      if (talentTypeId && talentTypeId.trim() !== "") {
        where.talentTypes = {
          some: {
            talentType: {
              id: talentTypeId,
            },
          },
        };
      }

      // Filter by email (exact or partial match)
      if (email && email.trim() !== "") {
        where.email = {
          contains: email,
          mode: "insensitive",
        };
      }

      // Search across multiple fields (only if no specific email filter is set)
      if (search && search.trim() !== "") {
        // If email filter is already set, don't search in email field
        const searchFields: any[] = [
          { name: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { bio: { contains: search, mode: "insensitive" } },
        ];

        // Only add email to search if email filter is not already set
        if (!email || email.trim() === "") {
          searchFields.push({ email: { contains: search, mode: "insensitive" } });
        }

        where.OR = searchFields;
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
            email: true,
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
            email: artist.email,
            avatar: artist.image || "",
            artworks: artist._count.artworks,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: artist.location || "",
            profileViews: artist.profileViews || 0,
            heatScore: artist.heatScore || 0,
            lastActiveAt: artist.lastActiveAt,
            // Format talent types consistently (flat array with id, name, slug)
            talentTypes:
              artist.talentTypes?.map((ut) => ({
                id: ut.talentType.id,
                name: ut.talentType.name,
                slug: ut.talentType.slug,
              })) || [],
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
          email: true,
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
            email: user.email,
            avatar: user.image || "",
            artworks: user.artworks.length,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: user.location || "",
            profileViews: user.profileViews || 0,
            heatScore: user.heatScore || 0,
            lastActiveAt: user.lastActiveAt,
            // Format talent types consistently (flat array with id, name, slug)
            talentTypes:
              user.talentTypes?.map((ut) => ({
                id: ut.talentType.id,
                name: ut.talentType.name,
                slug: ut.talentType.slug,
              })) || [],
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
          email: true,
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

          const salesCount = user.artworks.filter(
            (a) => a.orderItems.length > 0
          ).length;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.image || "",
            artworks: user.artworks.length,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: user.location || "",
            profileViews: user.profileViews || 0,
            heatScore: user.heatScore || 0,
            lastActiveAt: user.lastActiveAt,
            // Format talent types consistently (flat array with id, name, slug)
            talentTypes:
              user.talentTypes?.map((ut) => ({
                id: ut.talentType.id,
                name: ut.talentType.name,
                slug: ut.talentType.slug,
              })) || [],
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
            email: true,
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
            email: artist.email,
            avatar: artist.image || "",
            coverImage: artist.coverImage,
            location: artist.location || "",
            bio: artist.bio,
            profileViews: artist.profileViews || 0,
            heatScore: artist.heatScore || 0,
            lastActiveAt: artist.lastActiveAt,
            // Format talent types consistently (flat array with id, name, slug)
            talentTypes:
              artist.talentTypes?.map((ut) => ({
                id: ut.talentType.id,
                name: ut.talentType.name,
                slug: ut.talentType.slug,
              })) || [],
            artworks: artist._count.artworks,
            sales: sales,
            views: views,
            salesCount: salesCount,
            country: artist.location || "",
          };
        })
      );

      return {
        success: true,
        data: {
          artists: artistsWithStats,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            totalPages: Math.ceil(total / limit), // Keep for backward compatibility
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
