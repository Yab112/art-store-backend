import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FedExService } from "./fedex.service";
import {
  FedExTrackingScheduler,
  FEDEX_SANDBOX_MOCK_TRACKING,
} from "./fedex-tracking.scheduler";
import { GetRatesDto } from "./dto/get-rates.dto";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { AuthGuard } from "../../core/guards/auth.guard";

@Controller("fedex")
export class FedExController {
  constructor(
    private readonly fedexService: FedExService,
    private readonly trackingScheduler: FedExTrackingScheduler,
    private readonly configService: ConfigService,
  ) {}

  private get isSandbox(): boolean {
    return (
      this.configService.get<string>("FEDEX_API_URL")?.includes("sandbox") ??
      true
    );
  }

  @UseGuards(AuthGuard)
  @Post("rates")
  async getRates(@Request() req, @Body() getRatesDto: GetRatesDto) {
    return this.fedexService.getMultiOriginRates(
      req.user.id,
      getRatesDto.cartItemIds,
      getRatesDto.recipientAddress,
    );
  }

  @UseGuards(AuthGuard)
  @Post("shipments")
  async createShipment(
    @Request() req,
    @Body() createShipmentDto: CreateShipmentDto,
  ) {
    return this.fedexService.createShipment(
      req.user.id,
      createShipmentDto.orderId,
      createShipmentDto.senderAddress,
    );
  }

  @UseGuards(AuthGuard)
  @Post("shipments/retry-pending")
  async retryPendingShipments(@Request() req) {
    return this.fedexService.retryPendingShipmentsForArtist(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Post("shipments/:shipmentId/retry")
  async retryShipment(
    @Request() req,
    @Param("shipmentId") shipmentId: string,
  ) {
    return this.fedexService.retryShipment(req.user.id, shipmentId);
  }

  /**
   * Pull latest FedEx Track (Basic Integrated Visibility) for one shipment.
   * Sandbox optional body: { "mockTrackingNumber": "123456789012" } — still calls Track API.
   */
  @UseGuards(AuthGuard)
  @Post("shipments/:shipmentId/sync-tracking")
  async syncShipmentTracking(
    @Request() req,
    @Param("shipmentId") shipmentId: string,
    @Body() body?: { mockTrackingNumber?: string },
  ) {
    const shipment = await this.trackingScheduler.syncShipmentTracking(
      req.user.id,
      shipmentId,
      { mockTrackingNumber: body?.mockTrackingNumber },
    );
    return {
      success: true,
      shipment,
      ...(this.isSandbox
        ? { sandboxMockNumbers: FEDEX_SANDBOX_MOCK_TRACKING }
        : {}),
    };
  }

  @UseGuards(AuthGuard)
  @Get("my-shipments")
  async getMyShipments(@Request() req) {
    return this.fedexService.getArtistShipments(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Get("shipments/:orderId")
  async getOrderShipments(
    @Request() req,
    @Param("orderId") orderId: string,
  ) {
    return this.fedexService.getOrderShipments(req.user.id, orderId);
  }
}
