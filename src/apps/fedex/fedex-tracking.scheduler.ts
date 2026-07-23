import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../core/database/prisma.service";
import { FedExService } from "./fedex.service";
import { isValidFedExTrackingNumber } from "./fedex-validation";
import {
  computeShipmentStatusFromTrack,
  getFedExScanTimestamp,
  isTimestampInShipmentLifecycle,
  mapScanEventStatus,
  shipmentLifecycleStart,
  withLifecycleFilteredEvents,
} from "./fedex-tracking.mapper";
import axios from "axios";
import { ShipmentStatus } from "@prisma/client";

/** Well-known FedEx sandbox mock tracking numbers (Basic Integrated Visibility). */
export const FEDEX_SANDBOX_MOCK_TRACKING = {
  IN_TRANSIT: "123456789012",
  INITIATED: "449044304137821",
  OUT_FOR_DELIVERY: "231300687629630",
  DELIVERED: "797806677146",
} as const;

type TrackableShipment = {
  id: string;
  trackingNumber: string;
  status: string;
  createdAt: Date;
};

@Injectable()
export class FedExTrackingScheduler {
  private readonly logger = new Logger(FedExTrackingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fedexService: FedExService,
    private readonly configService: ConfigService,
  ) {}

  private get isSandbox(): boolean {
    return (
      this.configService.get<string>("FEDEX_API_URL")?.includes("sandbox") ??
      true
    );
  }

  /**
   * Poll FedEx Track (Basic Integrated Visibility) every hour.
   * Re-includes EXCEPTION so recoverable issues can move forward.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncTrackingEvents() {
    this.logger.log("[TRACKING-SYNC] Starting FedEx tracking sync...");

    const activeShipments = await this.prisma.shipment.findMany({
      where: {
        status: {
          notIn: ["DELIVERED", "CANCELLED", "PENDING_ADDRESS"],
        },
        trackingNumber: { not: null },
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        createdAt: true,
      },
    });

    const trackableShipments: TrackableShipment[] = activeShipments
      .filter((shipment) =>
        isValidFedExTrackingNumber(shipment.trackingNumber ?? ""),
      )
      .map((shipment) => ({
        id: shipment.id,
        trackingNumber: shipment.trackingNumber as string,
        status: shipment.status,
        createdAt: shipment.createdAt,
      }));

    if (trackableShipments.length === 0) {
      this.logger.log("[TRACKING-SYNC] No active FedEx shipments to sync.");
      return { synced: 0 };
    }

    this.logger.log(
      `[TRACKING-SYNC] Syncing ${trackableShipments.length} active shipment(s)...`,
    );

    const BATCH_SIZE = 30;
    for (let i = 0; i < trackableShipments.length; i += BATCH_SIZE) {
      const batch = trackableShipments.slice(i, i + BATCH_SIZE);
      await this.processBatch(batch);
    }

    this.logger.log("[TRACKING-SYNC] FedEx tracking sync complete.");
    return { synced: trackableShipments.length };
  }

  /**
   * Sync one shipment from FedEx Track.
   * Sandbox-only: optional mockTrackingNumber replaces SAMPLE ship numbers so
   * FedEx's documented mock track numbers can be exercised — still calls Track API.
   */
  async syncShipmentTracking(
    artistId: string,
    shipmentId: string,
    options?: { mockTrackingNumber?: string },
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, artistId },
    });
    if (!shipment) {
      throw new BadRequestException("Shipment not found");
    }

    let trackingNumber = shipment.trackingNumber;
    const mock = options?.mockTrackingNumber?.trim();

    if (mock) {
      if (!this.isSandbox) {
        throw new ForbiddenException(
          "Mock tracking numbers are only allowed in the FedEx sandbox",
        );
      }
      if (!isValidFedExTrackingNumber(mock)) {
        throw new BadRequestException("Invalid mock tracking number");
      }
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { trackingNumber: mock },
      });
      trackingNumber = mock;
      this.logger.log(
        `[TRACKING-SYNC] Sandbox: shipment ${shipmentId} using mock tracking ${mock}`,
      );
    }

    if (!trackingNumber || !isValidFedExTrackingNumber(trackingNumber)) {
      throw new BadRequestException(
        "Shipment has no valid FedEx tracking number to sync",
      );
    }

    try {
      await this.processBatch([
        {
          id: shipment.id,
          trackingNumber,
          status: shipment.status,
          createdAt: shipment.createdAt,
        },
      ]);
    } catch (error: any) {
      const message =
        error?.response?.data?.errors?.[0]?.message ||
        error?.message ||
        "FedEx Track sync failed";
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          lastTrackingSyncAt: new Date(),
          lastTrackingSyncError: String(message).slice(0, 500),
        },
      });
      throw error;
    }

    const updated = await this.prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: {
        events: { orderBy: { timestamp: "desc" }, take: 40 },
      },
    });
    if (!updated) return updated;

    return withLifecycleFilteredEvents(updated);
  }

  private async processBatch(shipments: TrackableShipment[]) {
    const token = await this.fedexService.getTrackOAuthToken();
    const apiUrl = this.fedexService.apiUrl;

    const payload = {
      includeDetailedScans: true,
      trackingInfo: shipments.map((s) => ({
        trackingNumberInfo: {
          trackingNumber: s.trackingNumber,
        },
      })),
    };

    let response;
    try {
      response = await axios.post(
        `${apiUrl}/track/v1/trackingnumbers`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-locale": "en_US",
          },
          timeout: 20_000,
        },
      );
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.errors?.[0]?.message ||
        error?.message ||
        "Track API request failed";
      this.logger.error(
        "[TRACKING-SYNC] Failed to sync tracking batch:",
        error?.response?.data || error?.message,
      );
      await Promise.all(
        shipments.map((s) =>
          this.prisma.shipment.update({
            where: { id: s.id },
            data: {
              lastTrackingSyncAt: new Date(),
              lastTrackingSyncError: String(errMsg).slice(0, 500),
            },
          }),
        ),
      );
      throw error;
    }

    const completeTrackResults: any[] =
      response.data?.output?.completeTrackResults || [];

    for (const result of completeTrackResults) {
      const trackingNumber = result.trackingNumber;
      const shipment = shipments.find(
        (s) => s.trackingNumber === trackingNumber,
      );
      if (!shipment) continue;

      const trackResults: any[] = result.trackResults || [];
      if (trackResults.length === 0) {
        await this.markSyncMeta(
          shipment.id,
          "FedEx returned no track results",
        );
        continue;
      }

      const trackResult = trackResults[0];
      if (trackResult?.error) {
        const msg = `${trackResult.error.code || "TRACK_ERROR"} ${trackResult.error.message || ""}`.trim();
        this.logger.warn(
          `[TRACKING-SYNC] Track error for ${trackingNumber}: ${msg}`,
        );
        await this.markSyncMeta(shipment.id, msg);
        continue;
      }

      await this.upsertTrackingData(
        shipment.id,
        shipment.status as ShipmentStatus,
        shipment.createdAt,
        trackResult,
      );
    }

    // Shipments missing from FedEx response still get a sync timestamp.
    const returned = new Set(
      completeTrackResults.map((r) => r.trackingNumber).filter(Boolean),
    );
    for (const shipment of shipments) {
      if (!returned.has(shipment.trackingNumber)) {
        await this.markSyncMeta(
          shipment.id,
          "Tracking number not present in FedEx Track response",
        );
      }
    }
  }

  private async markSyncMeta(shipmentId: string, error: string | null) {
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        lastTrackingSyncAt: new Date(),
        lastTrackingSyncError: error,
      },
    });
  }

  /**
   * Apply a FedEx Track result. Exported for unit testing via public wrapper.
   */
  async applyTrackResult(
    shipmentId: string,
    currentStatus: ShipmentStatus,
    trackResult: any,
    shipmentCreatedAt: Date = new Date("2026-01-01T00:00:00.000Z"),
  ) {
    return this.upsertTrackingData(
      shipmentId,
      currentStatus,
      shipmentCreatedAt,
      trackResult,
    );
  }

  private async upsertTrackingData(
    shipmentId: string,
    currentStatus: ShipmentStatus,
    shipmentCreatedAt: Date,
    trackResult: any,
  ) {
    try {
      const latestStatusCode: string =
        trackResult.latestStatusDetail?.code ||
        trackResult.latestStatusDetail?.derivedCode ||
        "";
      const rawScanEvents: any[] = trackResult.scanEvents || [];

      // Only scans from this label's lifecycle count toward status + stored history.
      const lifecycleScans = rawScanEvents.filter((scan) =>
        isTimestampInShipmentLifecycle(
          getFedExScanTimestamp(scan),
          shipmentCreatedAt,
        ),
      );

      // latestStatusDetail often has no date; use newest scan matching its code, else newest scan.
      const latestCodeUpper = latestStatusCode.trim().toUpperCase();
      const matchingScan = rawScanEvents.find((scan) => {
        const code = String(
          scan.derivedStatusCode || scan.eventType || "",
        )
          .trim()
          .toUpperCase();
        return code === latestCodeUpper;
      });
      const latestStatusAt = matchingScan
        ? getFedExScanTimestamp(matchingScan)
        : rawScanEvents[0]
          ? getFedExScanTimestamp(rawScanEvents[0])
          : null;

      const newStatus = computeShipmentStatusFromTrack({
        currentStatus,
        latestStatusCode,
        latestStatusAt,
        shipmentCreatedAt,
        inLifecycleScanCodes: lifecycleScans.map(
          (scan) => scan.derivedStatusCode || scan.eventType || "",
        ),
      });

      const estimatedDeliveryStr: string | undefined =
        trackResult.estimatedDeliveryTimeWindow?.window?.ends ||
        trackResult.estimatedDeliveryTimeWindow?.window?.begins;
      const estimatedDelivery = estimatedDeliveryStr
        ? new Date(estimatedDeliveryStr)
        : undefined;

      const existingEvents = await this.prisma.shipmentEvent.findMany({
        where: { shipmentId },
        select: { timestamp: true, description: true },
      });

      const existingKeys = new Set(
        existingEvents.map(
          (e) => `${e.timestamp.toISOString()}|${e.description}`,
        ),
      );

      const newEvents = lifecycleScans
        .map((scan: any) => {
          const timestamp = getFedExScanTimestamp(scan);
          const description =
            scan.eventDescription ||
            scan.derivedStatusCode ||
            "Tracking Update";
          const location = [
            scan.scanLocation?.city,
            scan.scanLocation?.stateOrProvinceCode,
            scan.scanLocation?.countryCode,
          ]
            .filter(Boolean)
            .join(", ");
          const key = `${timestamp.toISOString()}|${description}`;

          if (existingKeys.has(key)) return null;

          const statusCode: string =
            scan.derivedStatusCode || scan.eventType || "";
          return {
            shipmentId,
            status: mapScanEventStatus(statusCode, newStatus),
            description,
            location: location || null,
            timestamp,
          };
        })
        .filter(Boolean) as Array<{
        shipmentId: string;
        status: ShipmentStatus;
        description: string;
        location: string | null;
        timestamp: Date;
      }>;

      const lifecycleStart = shipmentLifecycleStart(shipmentCreatedAt);

      await this.prisma.$transaction(async (tx) => {
        await tx.shipment.update({
          where: { id: shipmentId },
          data: {
            ...(newStatus !== currentStatus ? { status: newStatus } : {}),
            ...(estimatedDelivery ? { estimatedDelivery } : {}),
            lastTrackingSyncAt: new Date(),
            lastTrackingSyncError: null,
          },
        });

        // Drop recycled / pre-label history already stored in our DB.
        await tx.shipmentEvent.deleteMany({
          where: {
            shipmentId,
            timestamp: { lt: lifecycleStart },
          },
        });

        if (newEvents.length > 0) {
          await tx.shipmentEvent.createMany({ data: newEvents });
        }
      });

      this.logger.log(
        `[TRACKING-SYNC] Shipment ${shipmentId}: fedexCode=${latestStatusCode || "none"} status=${currentStatus}->${newStatus} lifecycleScans=${lifecycleScans.length}/${rawScanEvents.length} +${newEvents.length} event(s)`,
      );
    } catch (err: any) {
      this.logger.error(
        `[TRACKING-SYNC] Failed to upsert tracking data for shipment ${shipmentId}:`,
        err?.message,
      );
      await this.markSyncMeta(
        shipmentId,
        err?.message || "Failed to apply Track result",
      );
    }
  }
}
