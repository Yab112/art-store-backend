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
}
