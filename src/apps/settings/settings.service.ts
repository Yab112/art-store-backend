import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { UpdatePaymentGatewayDto } from "./dto/update-payment-gateway.dto";
import { UpdatePaymentSettingsDto } from "./dto/update-payment-settings.dto";
import { UpdateOrderSettingsDto } from "./dto/update-order-settings.dto";
import { UpdateCollectionSettingsDto } from "./dto/update-collection-settings.dto";

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize default settings on module start
   */
  async onModuleInit() {
    await this.initializeDefaultSettings();
  }

  /**
   * Initialize default settings if they don't exist
   */
  private async initializeDefaultSettings() {
    try {
      const defaultPlatformSettings = {
        platformCommissionRate: 10,
        siteName: "Art Gallery",
      };

      const defaultPaymentSettings = {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0, // 0 = unlimited
        paymentTimeoutMinutes: 30,
        holdingPeriodDays: 7, // Funds must be held for 7 days before withdrawal
        platformCommissionRate: 10, // 10% platform commission
      };

      const defaultOrderSettings = {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };

      const defaultCollectionSettings = {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };

      // Initialize platform settings
      const platformKey = "platform";
      const existingPlatform = await this.prisma.settings.findUnique({
        where: { key: platformKey },
      });

      if (!existingPlatform) {
        await this.prisma.settings.create({
          data: {
            key: platformKey,
            category: "platform",
            value: defaultPlatformSettings,
          },
        });
        this.logger.log("Default platform settings initialized");
      }

      // Initialize payment settings
      const paymentKey = "payment";
      const existingPayment = await this.prisma.settings.findUnique({
        where: { key: paymentKey },
      });

      if (!existingPayment) {
        await this.prisma.settings.create({
          data: {
            key: paymentKey,
            category: "payment",
            value: defaultPaymentSettings,
          },
        });
        this.logger.log("Default payment settings initialized");
      }

      // Initialize order settings
      const orderKey = "order";
      const existingOrder = await this.prisma.settings.findUnique({
        where: { key: orderKey },
      });

      if (!existingOrder) {
        await this.prisma.settings.create({
          data: {
            key: orderKey,
            category: "order",
            value: defaultOrderSettings,
          },
        });
        this.logger.log("Default order settings initialized");
      }

      // Initialize collection settings
      const collectionKey = "collection";
      const existingCollection = await this.prisma.settings.findUnique({
        where: { key: collectionKey },
      });

      if (!existingCollection) {
        await this.prisma.settings.create({
          data: {
            key: collectionKey,
            category: "collection",
            value: defaultCollectionSettings,
          },
        });
        this.logger.log("Default collection settings initialized");
      }
    } catch (error) {
      this.logger.error("Failed to initialize default settings:", error);
    }
  }

  /**
   * Get setting by key
   */
  private async getSetting(key: string): Promise<any> {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });
    return setting?.value || null;
  }

  /**
   * Set or update setting by key
   */
  private async setSetting(
    key: string,
    value: any,
    category: string = "platform",
  ): Promise<void> {
    await this.prisma.settings.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value, category },
    });
  }

  /**
   * Get all system settings
   */
  async getAllSettings() {
    try {
      // Get platform settings
      const platformSettings = (await this.getSetting("platform")) || {
        platformCommissionRate: 10,
        siteName: "Art Gallery",
      };

      // Get payment settings
      const paymentSettings = (await this.getSetting("payment")) || {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0,
        paymentTimeoutMinutes: 30,
      };

      // Get order settings
      const orderSettings = (await this.getSetting("order")) || {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };

      // Get collection settings
      const collectionSettings = (await this.getSetting("collection")) || {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };

      // Get payment gateways
      const paymentGateways = await this.prisma.paymentGateway.findMany({
        orderBy: { name: "asc" },
      });

      return {
        platform: platformSettings,
        payment: paymentSettings,
        order: orderSettings,
        collection: collectionSettings,
        paymentGateways: paymentGateways.map((gw) => ({
          id: gw.id,
          name: gw.name,
          enabled: gw.enabled,
          config: gw.config,
          updatedAt: gw.updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error("Failed to fetch settings:", error);
      throw error;
    }
  }

  /**
   * Get platform settings
   */
  async getPlatformSettings() {
    try {
      const settings = (await this.getSetting("platform")) || {
        platformCommissionRate: 10,
        siteName: "Art Gallery",
      };

      return {
        success: true,
        settings,
      };
    } catch (error) {
      this.logger.error("Failed to fetch platform settings:", error);
      throw error;
    }
  }

  /**
   * Update platform settings
   */
  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    try {
      // Get current settings
      const currentSettings = (await this.getSetting("platform")) || {
        platformCommissionRate: 10,
        siteName: "Art Gallery",
      };

      // Update only provided fields
      const updatedSettings = {
        ...currentSettings,
        ...(dto.platformCommissionRate !== undefined && {
          platformCommissionRate: dto.platformCommissionRate,
        }),
        ...(dto.siteName !== undefined && { siteName: dto.siteName }),
      };

      // Save to database
      await this.setSetting("platform", updatedSettings, "platform");

      this.logger.log("Platform settings updated");

      return {
        success: true,
        message: "Platform settings updated successfully",
        settings: updatedSettings,
      };
    } catch (error) {
      this.logger.error("Failed to update platform settings:", error);
      throw error;
    }
  }

  /**
   * Get payment gateway settings
   */
  async getPaymentGateways() {
    try {
      const gateways = await this.prisma.paymentGateway.findMany({
        orderBy: { name: "asc" },
      });

      return {
        success: true,
        gateways: gateways.map((gw) => ({
          id: gw.id,
          name: gw.name,
          enabled: gw.enabled,
          config: gw.config,
          updatedAt: gw.updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error("Failed to fetch payment gateways:", error);
      throw error;
    }
  }

  /**
   * Update payment gateway
   */
  async updatePaymentGateway(id: string, dto: UpdatePaymentGatewayDto) {
    try {
      const gateway = await this.prisma.paymentGateway.findUnique({
        where: { id },
      });

      if (!gateway) {
        throw new NotFoundException(`Payment gateway with ID ${id} not found`);
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (dto.enabled !== undefined) {
        updateData.enabled = dto.enabled;
      }

      if (dto.config !== undefined) {
        updateData.config = dto.config;
      }

      const updated = await this.prisma.paymentGateway.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Payment gateway ${id} updated`);

      return {
        success: true,
        message: "Payment gateway updated successfully",
        gateway: {
          id: updated.id,
          name: updated.name,
          enabled: updated.enabled,
          config: updated.config,
          updatedAt: updated.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error("Failed to update payment gateway:", error);
      throw error;
    }
  }

  /**
   * Get payment settings
   */
  async getPaymentSettings() {
    try {
      const settings = (await this.getSetting("payment")) || {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0,
        paymentTimeoutMinutes: 30,
      };

      return {
        success: true,
        settings,
      };
    } catch (error) {
      this.logger.error("Failed to fetch payment settings:", error);
      throw error;
    }
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(dto: UpdatePaymentSettingsDto) {
    try {
      const currentSettings = (await this.getSetting("payment")) || {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0,
        paymentTimeoutMinutes: 30,
      };

      const updatedSettings = {
        ...currentSettings,
        ...(dto.minWithdrawalAmount !== undefined && {
          minWithdrawalAmount: dto.minWithdrawalAmount,
        }),
        ...(dto.maxWithdrawalAmount !== undefined && {
          maxWithdrawalAmount: dto.maxWithdrawalAmount,
        }),
        ...(dto.paymentTimeoutMinutes !== undefined && {
          paymentTimeoutMinutes: dto.paymentTimeoutMinutes,
        }),
      };

      await this.setSetting("payment", updatedSettings, "payment");

      this.logger.log("Payment settings updated");

      return {
        success: true,
        message: "Payment settings updated successfully",
        settings: updatedSettings,
      };
    } catch (error) {
      this.logger.error("Failed to update payment settings:", error);
      throw error;
    }
  }

  /**
   * Get order settings
   */
  async getOrderSettings() {
    try {
      const settings = (await this.getSetting("order")) || {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };

      return {
        success: true,
        settings,
      };
    } catch (error) {
      this.logger.error("Failed to fetch order settings:", error);
      throw error;
    }
  }

  /**
   * Update order settings
   */
  async updateOrderSettings(dto: UpdateOrderSettingsDto) {
    try {
      const currentSettings = (await this.getSetting("order")) || {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };

      const updatedSettings = {
        ...currentSettings,
        ...(dto.orderExpirationHours !== undefined && {
          orderExpirationHours: dto.orderExpirationHours,
        }),
        ...(dto.autoCancelPendingOrdersDays !== undefined && {
          autoCancelPendingOrdersDays: dto.autoCancelPendingOrdersDays,
        }),
      };

      await this.setSetting("order", updatedSettings, "order");

      this.logger.log("Order settings updated");

      return {
        success: true,
        message: "Order settings updated successfully",
        settings: updatedSettings,
      };
    } catch (error) {
      this.logger.error("Failed to update order settings:", error);
      throw error;
    }
  }

  /**
   * Get collection settings
   */
  async getCollectionSettings() {
    try {
      const settings = (await this.getSetting("collection")) || {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };

      return {
        success: true,
        settings,
      };
    } catch (error) {
      this.logger.error("Failed to fetch collection settings:", error);
      throw error;
    }
  }

  /**
   * Update collection settings
   */
  async updateCollectionSettings(dto: UpdateCollectionSettingsDto) {
    try {
      const currentSettings = (await this.getSetting("collection")) || {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };

      const updatedSettings = {
        ...currentSettings,
        ...(dto.maxCollectionsPerUser !== undefined && {
          maxCollectionsPerUser: dto.maxCollectionsPerUser,
        }),
        ...(dto.maxArtworksPerCollection !== undefined && {
          maxArtworksPerCollection: dto.maxArtworksPerCollection,
        }),
        ...(dto.minArtworksForPublish !== undefined && {
          minArtworksForPublish: dto.minArtworksForPublish,
        }),
      };

      await this.setSetting("collection", updatedSettings, "collection");

      this.logger.log("Collection settings updated");

      return {
        success: true,
        message: "Collection settings updated successfully",
        settings: updatedSettings,
      };
    } catch (error) {
      this.logger.error("Failed to update collection settings:", error);
      throw error;
    }
  }

  /**
   * Get platform commission rate (used by order service)
   * Now async since it reads from database
   */
  async getPlatformCommissionRate(): Promise<number> {
    try {
      const platformSettings = (await this.getSetting("platform")) || {
        platformCommissionRate: 10,
      };
      const rate = platformSettings.platformCommissionRate || 10;
      return rate / 100; // Convert percentage to decimal
    } catch (error) {
      this.logger.error("Failed to get platform commission rate:", error);
      return 0.1; // Default to 10% if error
    }
  }

  /**
   * Get minimum withdrawal amount (used by artist service)
   */
  async getMinWithdrawalAmount(): Promise<number> {
    try {
      const paymentSettings = (await this.getSetting("payment")) || {
        minWithdrawalAmount: 10,
      };
      return paymentSettings.minWithdrawalAmount || 10;
    } catch (error) {
      this.logger.error("Failed to get minimum withdrawal amount:", error);
      return 10; // Default to $10 if error
    }
  }

  /**
   * Get collection settings values (used by collections service)
   */
  async getCollectionSettingsValues(): Promise<{
    maxCollectionsPerUser: number;
    maxArtworksPerCollection: number;
    minArtworksForPublish: number;
  }> {
    try {
      const settings = (await this.getSetting("collection")) || {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };
      return {
        maxCollectionsPerUser: settings.maxCollectionsPerUser || 50,
        maxArtworksPerCollection: settings.maxArtworksPerCollection || 100,
        minArtworksForPublish: settings.minArtworksForPublish || 3,
      };
    } catch (error) {
      this.logger.error("Failed to get collection settings:", error);
      return {
        maxCollectionsPerUser: 50,
        maxArtworksPerCollection: 100,
        minArtworksForPublish: 3,
      };
    }
  }

  /**
   * Get payment settings values (used by artist service)
   */
  async getPaymentSettingsValues(): Promise<{
    minWithdrawalAmount: number;
    maxWithdrawalAmount: number;
    paymentTimeoutMinutes: number;
    holdingPeriodDays: number;
    platformCommissionRate: number;
  }> {
    try {
      const settings = (await this.getSetting("payment")) || {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0,
        paymentTimeoutMinutes: 30,
        holdingPeriodDays: 7,
        platformCommissionRate: 10,
      };
      return {
        minWithdrawalAmount: settings.minWithdrawalAmount || 10,
        maxWithdrawalAmount: settings.maxWithdrawalAmount || 0,
        paymentTimeoutMinutes: settings.paymentTimeoutMinutes || 30,
        holdingPeriodDays: settings.holdingPeriodDays || 7,
        platformCommissionRate: settings.platformCommissionRate || 10,
      };
    } catch (error) {
      this.logger.error("Failed to get payment settings:", error);
      return {
        minWithdrawalAmount: 10,
        maxWithdrawalAmount: 0,
        paymentTimeoutMinutes: 30,
        holdingPeriodDays: 7,
        platformCommissionRate: 10,
      };
    }
  }

  /**
   * Get order settings values (used by order service)
   */
  async getOrderSettingsValues(): Promise<{
    orderExpirationHours: number;
    autoCancelPendingOrdersDays: number;
  }> {
    try {
      const settings = (await this.getSetting("order")) || {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };
      return {
        orderExpirationHours: settings.orderExpirationHours || 24,
        autoCancelPendingOrdersDays: settings.autoCancelPendingOrdersDays || 7,
      };
    } catch (error) {
      this.logger.error("Failed to get order settings:", error);
      return {
        orderExpirationHours: 24,
        autoCancelPendingOrdersDays: 7,
      };
    }
  }
}
