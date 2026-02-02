import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  // UseGuards,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import {
  UpdatePlatformSettingsDto,
  UpdatePaymentGatewayDto,
  UpdatePaymentSettingsDto,
  UpdateOrderSettingsDto,
  UpdateCollectionSettingsDto,
} from "./dto";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
// import { AuthGuard } from '@/core/guards/auth.guard';

@ApiTags("Settings")
@Controller("settings")
// @UseGuards(AuthGuard) // Commented out for now
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get all system settings
   * GET /api/settings
   */
  @Get()
  @ApiOperation({ summary: "Get all system settings" })
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * Get platform settings
   * GET /api/settings/platform
   */
  @Get("platform")
  @ApiOperation({ summary: "Get platform settings" })
  async getPlatformSettings() {
    return this.settingsService.getPlatformSettings();
  }

  /**
   * Update platform settings
   * PUT /api/settings/platform
   */
  @Put("platform")
  @ApiOperation({ summary: "Update platform settings" })
  async updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settingsService.updatePlatformSettings(dto);
  }

  /**
   * Get payment gateway settings
   * GET /api/settings/payment-gateways
   */
  @Get("payment-gateways")
  @ApiOperation({ summary: "Get all payment gateway settings" })
  async getPaymentGateways() {
    return this.settingsService.getPaymentGateways();
  }

  /**
   * Update payment gateway
   * PUT /api/settings/payment-gateways/:id
   */
  @Put("payment-gateways/:id")
  @ApiOperation({ summary: "Update a payment gateway setting" })
  async updatePaymentGateway(
    @Param("id") id: string,
    @Body() dto: UpdatePaymentGatewayDto,
  ) {
    return this.settingsService.updatePaymentGateway(id, dto);
  }

  /**
   * Get payment settings
   * GET /api/settings/payment
   */
  @Get("payment")
  @ApiOperation({ summary: "Get payment settings" })
  async getPaymentSettings() {
    return this.settingsService.getPaymentSettings();
  }

  /**
   * Update payment settings
   * PUT /api/settings/payment
   */
  @Put("payment")
  @ApiOperation({ summary: "Update payment settings" })
  async updatePaymentSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.settingsService.updatePaymentSettings(dto);
  }

  /**
   * Get order settings
   * GET /api/settings/order
   */
  @Get("order")
  @ApiOperation({ summary: "Get order settings" })
  async getOrderSettings() {
    return this.settingsService.getOrderSettings();
  }

  /**
   * Update order settings
   * PUT /api/settings/order
   */
  @Put("order")
  @ApiOperation({ summary: "Update order settings" })
  async updateOrderSettings(@Body() dto: UpdateOrderSettingsDto) {
    return this.settingsService.updateOrderSettings(dto);
  }

  /**
   * Get collection settings
   * GET /api/settings/collection
   */
  @Get("collection")
  @ApiOperation({ summary: "Get collection settings" })
  async getCollectionSettings() {
    return this.settingsService.getCollectionSettings();
  }

  /**
   * Update collection settings
   * PUT /api/settings/collection
   */
  @Put("collection")
  @ApiOperation({ summary: "Update collection settings" })
  async updateCollectionSettings(@Body() dto: UpdateCollectionSettingsDto) {
    return this.settingsService.updateCollectionSettings(dto);
  }
}
