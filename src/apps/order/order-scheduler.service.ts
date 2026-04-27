import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../core/database/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { OrderStatus } from "@prisma/client";

@Injectable()
export class OrderSchedulerService {
  private readonly logger = new Logger(OrderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Cancel expired orders
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cancelExpiredOrders() {
    try {
      const orderSettings = await this.settingsService.getOrderSettingsValues();

      // If expiration is disabled (0), skip
      if (orderSettings.orderExpirationHours === 0) {
        return;
      }

      const expirationTime = new Date();
      expirationTime.setHours(
        expirationTime.getHours() - orderSettings.orderExpirationHours,
      );

      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: {
            lt: expirationTime,
          },
        },
      });

      if (expiredOrders.length > 0) {
        await this.prisma.order.updateMany({
          where: {
            id: { in: expiredOrders.map((o) => o.id) },
          },
          data: {
            status: OrderStatus.CANCELLED,
            updatedAt: new Date(),
          },
        });

        this.logger.log(`Cancelled ${expiredOrders.length} expired orders`);
      }
    } catch (error) {
      this.logger.error("Failed to cancel expired orders:", error);
    }
  }

  /**
   * Auto-cancel pending orders after X days
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCancelPendingOrders() {
    try {
      const orderSettings = await this.settingsService.getOrderSettingsValues();

      // If auto-cancel is disabled (0), skip
      if (orderSettings.autoCancelPendingOrdersDays === 0) {
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - orderSettings.autoCancelPendingOrdersDays,
      );

      const pendingOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      if (pendingOrders.length > 0) {
        await this.prisma.order.updateMany({
          where: {
            id: { in: pendingOrders.map((o) => o.id) },
          },
          data: {
            status: OrderStatus.CANCELLED,
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Auto-cancelled ${pendingOrders.length} pending orders older than ${orderSettings.autoCancelPendingOrdersDays} days`,
        );
      }
    } catch (error) {
      this.logger.error("Failed to auto-cancel pending orders:", error);
    }
  }
}
