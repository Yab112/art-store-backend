import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../core/database/prisma.service";
import axios from "axios";
import { RecipientAddressDto } from "./dto/get-rates.dto";
import { SenderAddressDto } from "./dto/create-shipment.dto";
import { S3Service } from "../../libraries/s3/s3.service";
import {
  assertArtistShippableOrigin,
  assertRecipientAddress,
  assertSenderAddress,
  artistProfileToSenderAddress,
  buildCustomsClearanceDetail,
  buildCustomsCommodityDescription,
  buildFedExAddress,
  formatFedExApiErrors,
  getArtistShippingProfileIssues,
  getPhoneIssue,
  getRequiredFedExAccountNumber,
  getRequiredFedExDefaultHsCode,
  hasCompleteArtistShippingProfile,
  isInternationalLane,
  normalizeFedExTransitDays,
  normalizePhoneForFedEx,
  parseDimensionsInches,
  parseWeightKg,
  reconcilePostalAddress,
  getPostalCodeIssue,
} from "./fedex-validation";
import { withLifecycleFilteredEvents } from "./fedex-tracking.mapper";

@Injectable()
export class FedExService {
  private readonly logger = new Logger(FedExService.name);
  private oauthToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private trackOauthToken: string | null = null;
  private trackTokenExpiresAt: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  private get isSandbox(): boolean {
    return (
      this.configService.get<string>("FEDEX_API_URL")?.includes("sandbox") ??
      true
    );
  }

  get apiUrl(): string {
    return (
      this.configService.get<string>("FEDEX_API_URL") ||
      "https://apis-sandbox.fedex.com"
    );
  }

  /** Prefer Nest HttpException body / Axios FedEx body over generic Error.message. */
  private extractHttpErrorMessage(error: any): string {
    const nest = error?.getResponse?.();
    if (typeof nest === "string" && nest.trim()) return nest;
    if (nest && typeof nest === "object") {
      const msg = nest.message ?? nest.data;
      if (Array.isArray(msg) && msg.length) return msg.join(" ");
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    const axiosMsg =
      error?.response?.data?.errors?.[0]?.message ||
      error?.response?.data?.message ||
      error?.response?.data?.error_description;
    if (typeof axiosMsg === "string" && axiosMsg.trim()) return axiosMsg;
    return String(error?.message || "Unknown error");
  }

  /** Network / DNS / timeout errors talking to FedEx (not invalid credentials). */
  private isFedExUnreachableError(error: any): boolean {
    const code = String(
      error?.code || error?.cause?.code || error?.errno || "",
    ).toUpperCase();
    const message = this.extractHttpErrorMessage(error).toLowerCase();
    return (
      [
        "ETIMEDOUT",
        "ECONNABORTED",
        "ECONNREFUSED",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ECONNRESET",
        "ENETUNREACH",
      ].includes(code) ||
      message.includes("timeout") ||
      message.includes("network error") ||
      message.includes("unreachable")
    );
  }

  /**
   * OAuth for Ship / Rates / Address APIs (shipping project credentials).
   */
  async getOAuthToken(): Promise<string> {
    return this.fetchOAuthToken({
      clientIdKey: "FEDEX_CLIENT_ID",
      clientSecretKey: "FEDEX_CLIENT_SECRET",
      cache: "ship",
      label: "FedEx Ship/Rates",
    });
  }

  /**
   * OAuth for Track / Basic Integrated Visibility (separate FedEx project).
   * Production requires dedicated track keys. Sandbox may fall back to ship keys.
   */
  async getTrackOAuthToken(): Promise<string> {
    const trackId = this.configService.get<string>("FEDEX_TRACK_CLIENT_ID")?.trim();
    const trackSecret = this.configService
      .get<string>("FEDEX_TRACK_CLIENT_SECRET")
      ?.trim();

    if (trackId && trackSecret) {
      return this.fetchOAuthToken({
        clientIdKey: "FEDEX_TRACK_CLIENT_ID",
        clientSecretKey: "FEDEX_TRACK_CLIENT_SECRET",
        cache: "track",
        label: "FedEx Track",
      });
    }

    if (!this.isSandbox) {
      throw new InternalServerErrorException(
        "FEDEX_TRACK_CLIENT_ID/SECRET are required in production for Basic Integrated Visibility",
      );
    }

    this.logger.warn(
      "FEDEX_TRACK_CLIENT_ID/SECRET not set — falling back to ship credentials for Track API (sandbox only)",
    );
    return this.getOAuthToken();
  }

  private async fetchOAuthToken(params: {
    clientIdKey: string;
    clientSecretKey: string;
    cache: "ship" | "track";
    label: string;
  }): Promise<string> {
    const now = Date.now();
    if (params.cache === "ship" && this.oauthToken && now < this.tokenExpiresAt) {
      return this.oauthToken;
    }
    if (
      params.cache === "track" &&
      this.trackOauthToken &&
      now < this.trackTokenExpiresAt
    ) {
      return this.trackOauthToken;
    }

    const clientId = this.configService.get<string>(params.clientIdKey)?.trim();
    const clientSecret = this.configService
      .get<string>(params.clientSecretKey)
      ?.trim();

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        `${params.label} credentials are not configured (${params.clientIdKey})`,
      );
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 15_000,
        },
      );

      const token = response.data.access_token as string;
      const expiresAt = now + (response.data.expires_in - 60) * 1000;

      if (params.cache === "track") {
        this.trackOauthToken = token;
        this.trackTokenExpiresAt = expiresAt;
      } else {
        this.oauthToken = token;
        this.tokenExpiresAt = expiresAt;
      }

      this.logger.log(`Successfully refreshed ${params.label} OAuth token`);
      return token;
    } catch (error: any) {
      const detail =
        error?.response?.data ||
        error?.cause ||
        error?.errors ||
        error?.code ||
        error?.message ||
        error;
      this.logger.error(
        `Failed to get ${params.label} OAuth token`,
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );

      if (this.isFedExUnreachableError(error)) {
        throw new InternalServerErrorException(
          `${params.label} API unreachable (${error?.code || "timeout"}). This machine cannot open HTTPS to ${this.apiUrl} — fix network egress (VPN/ISP), then retry.`,
        );
      }

      const fedexMsg =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.error_description ||
        error?.response?.data?.error;
      throw new InternalServerErrorException(
        fedexMsg
          ? `Failed to authenticate with ${params.label} API: ${fedexMsg}`
          : `Failed to authenticate with ${params.label} API`,
      );
    }
  }

  async getMultiOriginRates(
    buyerId: string,
    cartItemIds: string[],
    recipient: RecipientAddressDto,
  ) {
    if (!cartItemIds || cartItemIds.length === 0) {
      throw new BadRequestException("No items provided for shipping rates");
    }

    const recipientCountry = (recipient.country || "").trim().toUpperCase();
    const recipientZip = (recipient.zipCode || "").trim();
    if (!recipientCountry || !recipientZip) {
      throw new BadRequestException(
        "Recipient country and postal/ZIP code are required for shipping rates",
      );
    }
    const postalIssue = getPostalCodeIssue(recipientZip, recipientCountry);
    if (postalIssue) {
      throw new BadRequestException(`Recipient address: ${postalIssue}`);
    }

    // 1. Fetch cart items and related artworks
    const cartItems = await this.prisma.cartItem.findMany({
      where: {
        id: { in: cartItemIds },
        userId: buyerId,
      },
      include: {
        artwork: {
          include: { user: true },
        },
      },
    });

    if (cartItems.length !== cartItemIds.length) {
      throw new BadRequestException(
        "Some cart items were not found or do not belong to you",
      );
    }

    // 2. Group by Artist
    const artistGroups = new Map<string, { artist: any; items: any[] }>();
    for (const item of cartItems) {
      const artistId = item.artwork.userId;
      if (!artistGroups.has(artistId)) {
        artistGroups.set(artistId, { artist: item.artwork.user, items: [] });
      }
      artistGroups.get(artistId)!.items.push(item);
    }

    // 3. For each artist, prepare package data and fetch rate
    const ratePromises = Array.from(artistGroups.values()).map(
      async (group) => {
        const packages = [];

        for (const item of group.items) {
          const context = `Artwork "${item.artwork.title || item.artwork.id}"`;
          const weightKg = parseWeightKg(item.artwork.weight, context);
          const dimensionsInches = parseDimensionsInches(
            item.artwork.dimensions,
            context,
          );

          packages.push({
            groupPackageCount: item.quantity,
            weight: {
              units: "LB",
              value: Number((weightKg * 2.20462).toFixed(2)),
            },
            dimensions: {
              length: dimensionsInches.length,
              width: dimensionsInches.width,
              height: dimensionsInches.height,
              units: "IN",
            },
            declaredValue: {
              amount: Number(item.artwork.desiredPrice),
              currency: "USD",
            },
            description: buildCustomsCommodityDescription({
              title: item.artwork.title,
              support: item.artwork.support,
            }),
          });
        }

        // Same shippable-origin rules as label creation — fail rates before payment if incomplete.
        try {
          assertArtistShippableOrigin(
            group.artist,
            `Artist "${group.artist.name || "Unknown"}" shipping address`,
          );
        } catch (error: any) {
          throw new BadRequestException(
            `Shipping calculation failed: ${error?.message || "Artist shipping address is incomplete"}. The artist must update their shipping address in Settings.`,
          );
        }

        const originCountry = (
          group.artist.addressCountry || ""
        ).trim().toUpperCase();
        const origin = {
          zipCode: group.artist.addressZipCode,
          country: originCountry,
        };

        try {
          return await this.fetchFedExRates(
            origin,
            { ...recipient, country: recipientCountry, zipCode: recipientZip },
            packages,
          );
        } catch (error: any) {
          throw new BadRequestException(
            `FedEx shipping rate calculation failed for artist "${group.artist.name || "Unknown"}": ${this.extractHttpErrorMessage(error)}`,
          );
        }
      },
    );

    const ratesResults = await Promise.all(ratePromises);

    // 4. Aggregate Rates (Sum charges for matching service types)
    // Find intersection of available service types across all artists
    // For simplicity, we sum up services that have the same type. If an artist doesn't have a service, we omit it.
    const aggregatedRates = new Map<string, any>();

    // Count how many artists support each service
    const serviceCounts = new Map<string, number>();

    for (const artistRates of ratesResults) {
      for (const rate of artistRates) {
        const type = rate.serviceType;
        serviceCounts.set(type, (serviceCounts.get(type) || 0) + 1);

        if (!aggregatedRates.has(type)) {
          aggregatedRates.set(type, { ...rate });
        } else {
          const existing = aggregatedRates.get(type);
          existing.totalCharge += rate.totalCharge;
          if (
            rate.transitDays &&
            rate.transitDays > (existing.transitDays || 0)
          ) {
            existing.transitDays = rate.transitDays;
          }
        }
      }
    }

    // Only keep services that ALL artists support
    const numArtists = artistGroups.size;
    const finalRates = Array.from(aggregatedRates.values()).filter(
      (rate) => serviceCounts.get(rate.serviceType) === numArtists,
    );

    if (finalRates.length === 0) {
      throw new BadRequestException(
        "No shipping services are available for this origin and destination. Check the seller and buyer addresses, then try again.",
      );
    }

    return { success: true, rates: finalRates };
  }

  private async fetchFedExRates(
    origin: any,
    destination: any,
    packages: Array<{
      groupPackageCount: number;
      weight: { units: string; value: number };
      dimensions: {
        length: number;
        width: number;
        height: number;
        units: string;
      };
      declaredValue: { amount: number; currency: string };
      description?: string;
    }>,
  ) {
    const token = await this.getOAuthToken();
    const accountNumber = getRequiredFedExAccountNumber(this.configService);

    // FedEx Rates & Transit Times API:
    // POST {apiUrl}/rate/v1/rates/quotes with OAuth bearer + accountNumber + requestedShipment.
    // Docs: https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html
    const shipDatestamp = new Date().toISOString().slice(0, 10);
    const packageLineItems = packages.map(
      ({ description: _description, ...pkg }) => pkg,
    );

    const requestedShipment: Record<string, unknown> = {
      shipDatestamp,
      shipper: {
        address: { postalCode: origin.zipCode, countryCode: origin.country },
      },
      recipient: {
        address: {
          postalCode: destination.zipCode,
          countryCode: destination.country,
        },
      },
      pickupType: "DROPOFF_AT_FEDEX_LOCATION",
      rateRequestType: ["ACCOUNT", "LIST"],
      packagingType: "YOUR_PACKAGING",
      requestedPackageLineItems: packageLineItems,
    };

    if (isInternationalLane(origin.country, destination.country)) {
      const harmonizedCode = getRequiredFedExDefaultHsCode(this.configService);
      requestedShipment.customsClearanceDetail = buildCustomsClearanceDetail({
        accountNumber,
        harmonizedCode,
        commodities: packages.map((pkg) => {
          const quantity = pkg.groupPackageCount || 1;
          return {
            description: pkg.description || "Original artwork",
            quantity,
            // Commodity weight is the total for the line, not per unit.
            weightLb: Number((pkg.weight.value * quantity).toFixed(2)),
            unitPrice: pkg.declaredValue.amount,
            currency: pkg.declaredValue.currency,
            // Seller ship-from country — not Artwork.origin provenance.
            countryOfManufacture: origin.country,
          };
        }),
      });
    }

    const payload = {
      accountNumber: {
        value: accountNumber,
      },
      rateRequestControlParameters: {
        returnTransitTimes: true,
      },
      requestedShipment,
    };

    try {
      console.log(
        "[FedEx Rate API] Request payload:",
        JSON.stringify(payload, null, 2),
      );

      const response = await axios.post(
        `${this.apiUrl}/rate/v1/rates/quotes`,
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

      console.log(
        "[FedEx Rate API] Response:",
        JSON.stringify(response.data, null, 2),
      );

      const rateReplyDetails = response.data?.output?.rateReplyDetails || [];
      if (rateReplyDetails.length === 0) {
        throw new InternalServerErrorException(
          "FedEx did not return any shipping rates for this shipment",
        );
      }

      return rateReplyDetails.map((detail: any) => {
        const ratedShipment = detail.ratedShipmentDetails?.[0];
        const totalNetCharge = ratedShipment?.totalNetCharge;
        if (totalNetCharge == null) {
          throw new InternalServerErrorException(
            `FedEx returned an incomplete rate quote for ${detail.serviceType}`,
          );
        }

        return {
          serviceType: detail.serviceType,
          serviceName: detail.serviceName,
          totalCharge: parseFloat(totalNetCharge),
          currency: ratedShipment?.currency || "USD",
          transitDays: normalizeFedExTransitDays(
            detail.commit?.transitDays ??
              detail.commit?.transitTime ??
              detail.operationalDetail?.transitTime,
          ),
        };
      });
    } catch (error: any) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const fedexError = formatFedExApiErrors(
        error?.response?.data ?? error?.message,
      );

      console.log(
        "[FedEx Rate API] Error response:",
        JSON.stringify(error?.response?.data ?? error?.message, null, 2),
      );

      this.logger.error("FedEx Rate API failed:", fedexError);

      if (this.isFedExUnreachableError(error)) {
        throw new InternalServerErrorException(
          `FedEx Rate API unreachable (${error?.code || "timeout"}). Check network access to ${this.apiUrl}.`,
        );
      }

      throw new InternalServerErrorException(
        typeof fedexError === "string"
          ? `FedEx rate request failed: ${fedexError}`
          : "FedEx rate request failed",
      );
    }
  }

  /**
   * Create FedEx shipments for all artists in a paid order.
   * Always persists a shipment row: LABEL_CREATED, PENDING_ADDRESS, or EXCEPTION.
   */
  async createShipmentsForOrder(order: {
    id: string;
    items: Array<{
      id: string;
      artwork?: {
        userId?: string;
        user?: { id?: string };
      };
    }>;
  }) {
    this.logger.log(
      `[SHIPMENT-CREATE] Processing paid order ${order.id} for FedEx shipment creation`,
    );

    const results = {
      created: [] as string[],
      skipped: [] as Array<{ artistId: string; reason: string }>,
      failed: [] as Array<{ artistId: string; reason: string }>,
    };

    try {
      const artistGroups = new Map<string, any[]>();
      for (const item of order.items) {
        const artistId = item.artwork?.userId || item.artwork?.user?.id;
        if (!artistId) {
          this.logger.warn(
            `[SHIPMENT-CREATE] Item ${item.id} has no resolvable artistId — skipping`,
          );
          continue;
        }
        if (!artistGroups.has(artistId)) {
          artistGroups.set(artistId, []);
        }
        artistGroups.get(artistId)!.push(item);
      }

      for (const [artistId] of artistGroups.entries()) {
        const artist = await this.prisma.user.findUnique({
          where: { id: artistId },
        });

        if (!artist) {
          const reason = "Artist account not found";
          results.failed.push({ artistId, reason });
          await this.persistShipmentOutcome({
            orderId: order.id,
            artistId,
            status: "EXCEPTION",
            serviceType: await this.getOrderServiceType(order.id),
            failureReason: reason,
            eventDescription: reason,
          });
          continue;
        }

        const existing = await this.prisma.shipment.findFirst({
          where: { orderId: order.id, artistId },
        });
        if (
          existing &&
          !["PENDING_ADDRESS", "EXCEPTION"].includes(existing.status)
        ) {
          this.logger.warn(
            `[SHIPMENT-CREATE] Shipment already exists for order ${order.id}, artist ${artistId} (${existing.status})`,
          );
          results.skipped.push({
            artistId,
            reason: `Shipment already ${existing.status}`,
          });
          continue;
        }

        const profileIssues = getArtistShippingProfileIssues(artist);
        if (profileIssues.length > 0) {
          const reason = profileIssues.join("; ");
          results.skipped.push({ artistId, reason });
          this.logger.error(
            `[SHIPMENT-CREATE] Incomplete shipping profile for order ${order.id}, artist ${artistId}: ${reason}`,
          );
          await this.persistShipmentOutcome({
            orderId: order.id,
            artistId,
            status: "PENDING_ADDRESS",
            serviceType: await this.getOrderServiceType(order.id),
            failureReason: reason,
            eventDescription: `Waiting for artist shipping address: ${reason}`,
          });
          continue;
        }

        const senderAddress: SenderAddressDto =
          artistProfileToSenderAddress(artist as any);

        try {
          assertSenderAddress(senderAddress, "Artist shipping address");
          await this.createShipment(artistId, order.id, senderAddress);
          results.created.push(artistId);
          this.logger.log(
            `[SHIPMENT-CREATE] Created shipment for order ${order.id}, artist ${artistId}`,
          );
        } catch (err: any) {
          const reason = err?.message || "Unknown FedEx error";
          results.failed.push({ artistId, reason });
          this.logger.error(
            `[SHIPMENT-CREATE] Failed for order ${order.id}, artist ${artistId}: ${reason}`,
          );
          await this.persistShipmentOutcome({
            orderId: order.id,
            artistId,
            status: "EXCEPTION",
            serviceType: await this.getOrderServiceType(order.id),
            failureReason: reason,
            eventDescription: `FedEx label creation failed: ${reason}`,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(
        `[SHIPMENT-CREATE] Unexpected error for order ${order.id}: ${error?.message}`,
      );
      throw error;
    }

    this.logger.log(
      `[SHIPMENT-CREATE] Order ${order.id} complete — created: ${results.created.length}, skipped: ${results.skipped.length}, failed: ${results.failed.length}`,
    );

    return results;
  }

  private async getOrderServiceType(orderId: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { transaction: true },
    });
    const metadata = order?.transaction?.metadata as any;
    return metadata?.shippingOption?.serviceType || "UNKNOWN";
  }

  private async persistShipmentOutcome(params: {
    orderId: string;
    artistId: string;
    status: "PENDING_ADDRESS" | "EXCEPTION";
    serviceType: string;
    failureReason: string;
    eventDescription: string;
  }) {
    const existing = await this.prisma.shipment.findFirst({
      where: { orderId: params.orderId, artistId: params.artistId },
    });

    if (
      existing &&
      !["PENDING_ADDRESS", "EXCEPTION"].includes(existing.status)
    ) {
      return existing;
    }

    if (existing) {
      return this.prisma.shipment.update({
        where: { id: existing.id },
        data: {
          status: params.status,
          serviceType: params.serviceType,
          failureReason: params.failureReason,
          trackingNumber: null,
          masterTrackingId: null,
          labelUrl: null,
          events: {
            create: [
              {
                status: params.status,
                description: params.eventDescription,
                timestamp: new Date(),
              },
            ],
          },
        },
      });
    }

    return this.prisma.shipment.create({
      data: {
        orderId: params.orderId,
        artistId: params.artistId,
        serviceType: params.serviceType,
        status: params.status,
        failureReason: params.failureReason,
        events: {
          create: [
            {
              status: params.status,
              description: params.eventDescription,
              timestamp: new Date(),
            },
          ],
        },
      },
    });
  }

  /**
   * Retry label creation for PENDING_ADDRESS / EXCEPTION shipments after the
   * artist fixes their shipping profile.
   */
  async retryShipment(artistId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, artistId },
    });
    if (!shipment) {
      throw new BadRequestException("Shipment not found");
    }
    if (!["PENDING_ADDRESS", "EXCEPTION"].includes(shipment.status)) {
      throw new BadRequestException(
        `Shipment cannot be retried from status ${shipment.status}`,
      );
    }

    const artist = await this.prisma.user.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new BadRequestException("Artist account not found");
    }

    assertArtistShippableOrigin(artist, "Artist shipping address");
    const senderAddress = artistProfileToSenderAddress(artist as any);

    try {
      return await this.createShipment(artistId, shipment.orderId, senderAddress);
    } catch (err: any) {
      const raw =
        err?.response?.message ||
        err?.message ||
        "Label generation failed";
      const reason = Array.isArray(raw) ? raw.join(" ") : String(raw);
      // Update failureReason only — do not append raw backend errors as shipment events.
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: "EXCEPTION",
          failureReason: reason,
          serviceType: shipment.serviceType || "UNKNOWN",
        },
      });
      throw err;
    }
  }

  async retryPendingShipmentsForArtist(artistId: string) {
    const artist = await this.prisma.user.findUnique({
      where: { id: artistId },
    });
    if (!artist || !hasCompleteArtistShippingProfile(artist)) {
      return { retried: 0, created: 0, failed: 0, ensured: 0 };
    }

    // Only touch recent paid orders missing a shipment row (avoid scanning history forever).
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: "PAID",
        createdAt: { gte: ninetyDaysAgo },
        items: { some: { artwork: { userId: artistId } } },
        shipments: { none: { artistId } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: {
          include: {
            artwork: { include: { user: true } },
          },
        },
        transaction: true,
      },
    });

    let ensured = 0;
    for (const order of paidOrders) {
      await this.createShipmentsForOrder(order);
      ensured++;
    }

    // Auto-retry rows that were waiting on address — not every historical EXCEPTION.
    const pending = await this.prisma.shipment.findMany({
      where: {
        artistId,
        status: "PENDING_ADDRESS",
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    let created = 0;
    let failed = 0;
    for (const shipment of pending) {
      try {
        await this.retryShipment(artistId, shipment.id);
        created++;
      } catch (err: any) {
        failed++;
        this.logger.error(
          `[SHIPMENT-RETRY] Failed for shipment ${shipment.id}: ${err?.message}`,
        );
        await this.persistShipmentOutcome({
          orderId: shipment.orderId,
          artistId,
          status: "EXCEPTION",
          serviceType: shipment.serviceType || "UNKNOWN",
          failureReason: err?.message || "Retry failed",
          eventDescription: `Retry failed: ${err?.message || "Unknown error"}`,
        });
      }
    }

    return { retried: pending.length, created, failed, ensured };
  }

  /**
   * Prefer the checkout shipping address on the order. If its phone is missing/invalid,
   * fall back to the buyer's saved profile phone (addressPhone / phone).
   * Seller profile phone is never used for the recipient.
   */
  private async resolveRecipientAddressForShipment(
    order: { userId?: string | null; buyerEmail?: string | null },
    shippingAddress: any,
  ) {
    if (!shippingAddress || typeof shippingAddress !== "object") {
      return shippingAddress;
    }

    const country = String(shippingAddress.country || "US").trim().toUpperCase();
    const checkoutPhone = String(shippingAddress.phone || "").trim();
    const checkoutPhoneOk =
      Boolean(checkoutPhone) && !getPhoneIssue(checkoutPhone, country);

    if (checkoutPhoneOk) {
      return { ...shippingAddress, country, phone: checkoutPhone };
    }

    let buyer: {
      addressPhone: string | null;
      phone: string | null;
    } | null = null;

    if (order.userId) {
      buyer = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { addressPhone: true, phone: true },
      });
    } else if (order.buyerEmail) {
      buyer = await this.prisma.user.findFirst({
        where: { email: order.buyerEmail },
        select: { addressPhone: true, phone: true },
      });
    }

    const profilePhone = (buyer?.addressPhone || buyer?.phone || "").trim();
    if (profilePhone && !getPhoneIssue(profilePhone, country)) {
      this.logger.warn(
        `Order recipient checkout phone invalid/missing (${checkoutPhone || "empty"}); using buyer profile phone for country ${country}`,
      );
      return { ...shippingAddress, country, phone: profilePhone };
    }

    return { ...shippingAddress, country, phone: checkoutPhone || profilePhone };
  }

  async createShipment(
    artistId: string,
    orderId: string,
    senderAddress: SenderAddressDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { transaction: true },
    });

    if (!order) throw new BadRequestException("Order not found");

    assertSenderAddress(senderAddress, "Sender address");

    const metadata = order.transaction?.metadata as any;
    const shippingOption = metadata?.shippingOption;
    const serviceType = shippingOption?.serviceType;
    if (!serviceType) {
      throw new BadRequestException(
        "Order is missing the selected FedEx service type",
      );
    }

    const recipientAddress = await this.resolveRecipientAddressForShipment(
      order,
      metadata?.shippingAddress,
    );
    assertRecipientAddress(recipientAddress);

    const recipientName = recipientAddress.fullName.trim();
    const recipientCountry = recipientAddress.country.trim();
    const recipientPhone = normalizePhoneForFedEx(
      recipientAddress.phone,
      recipientCountry,
    );
    const recipientStreet = recipientAddress.address.trim();
    const recipientCity = recipientAddress.city.trim();
    const recipientState = recipientAddress.state?.trim();
    const recipientZip = recipientAddress.zipCode.trim();

    const senderCountry = senderAddress.country.trim();

    const shipperReconciled = await reconcilePostalAddress({
      city: senderAddress.city,
      state: senderAddress.state,
      postalCode: senderAddress.zipCode,
      country: senderCountry,
    });
    const shipperAddress = buildFedExAddress({
      streetLines: [senderAddress.address, senderAddress.apartment ?? ""],
      city: shipperReconciled.city,
      state: shipperReconciled.state,
      postalCode: senderAddress.zipCode,
      country: senderCountry,
      context: "Sender address",
    });

    const recipientReconciled = await reconcilePostalAddress({
      city: recipientCity,
      state: recipientState,
      postalCode: recipientZip,
      country: recipientCountry,
    });
    const recipientFedExAddress = buildFedExAddress({
      streetLines: [recipientStreet],
      city: recipientReconciled.city,
      state: recipientReconciled.state,
      postalCode: recipientZip,
      country: recipientCountry,
      context: "Recipient address",
    });

    const senderPhone = normalizePhoneForFedEx(
      senderAddress.phone,
      senderCountry,
    );

    // Calculate total weight of artist's items in the order
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        artwork: {
          userId: artistId,
        },
      },
      include: {
        artwork: true,
      },
    });

    let totalWeightKg = 0;
    let packageDimensions: { length: number; width: number; height: number } | null =
      null;

    for (const item of orderItems) {
      const itemWeight = parseWeightKg(
        item.artwork.weight,
        `Artwork "${item.artwork.title || item.artwork.id}"`,
      );
      totalWeightKg += itemWeight * item.quantity;

      const itemDimensions = parseDimensionsInches(
        item.artwork.dimensions,
        `Artwork "${item.artwork.title || item.artwork.id}"`,
      );
      if (
        !packageDimensions ||
        itemDimensions.length * itemDimensions.width * itemDimensions.height >
          packageDimensions.length *
            packageDimensions.width *
            packageDimensions.height
      ) {
        packageDimensions = itemDimensions;
      }
    }

    if (!packageDimensions) {
      throw new BadRequestException(
        "Shipment requires valid artwork dimensions",
      );
    }

    const fedexAccountNumber = getRequiredFedExAccountNumber(this.configService);

    // Use a unique transaction ID for tracking request
    const customerTransactionId = `TX-${orderId}-${artistId}-${Date.now()}`;

    let trackingNumber: string;
    let masterTrackingId: string;
    let labelUrl: string;

    try {
      const token = await this.getOAuthToken();
      const requestedShipment: Record<string, unknown> = {
        shipDatestamp: new Date().toISOString().slice(0, 10),
        shipper: {
          contact: {
            personName: senderAddress.fullName.trim(),
            phoneNumber: senderPhone,
          },
          address: shipperAddress,
        },
        recipients: [
          {
            contact: {
              personName: recipientName,
              phoneNumber: recipientPhone,
            },
            address: recipientFedExAddress,
          },
        ],
        serviceType: serviceType,
        packagingType: "YOUR_PACKAGING",
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        shippingChargesPayment: {
          paymentType: "SENDER",
          payor: {
            responsibleParty: {
              accountNumber: {
                value: fedexAccountNumber,
              },
            },
          },
        },
        labelSpecification: {
          imageType: "PDF",
          labelStockType: "PAPER_85X11_TOP_HALF_LABEL",
        },
        requestedPackageLineItems: [
          {
            weight: {
              // Keep English units with IN dimensions (FedEx rejects mixed KG+IN).
              value: Number((totalWeightKg * 2.20462).toFixed(2)),
              units: "LB",
            },
            dimensions: { ...packageDimensions, units: "IN" },
          },
        ],
      };

      if (isInternationalLane(senderCountry, recipientCountry)) {
        const harmonizedCode = getRequiredFedExDefaultHsCode(this.configService);
        requestedShipment.customsClearanceDetail = buildCustomsClearanceDetail({
          accountNumber: fedexAccountNumber,
          harmonizedCode,
          commodities: orderItems.map((item) => {
            const qty = item.quantity || 1;
            const weightKg = parseWeightKg(
              item.artwork.weight,
              `Artwork "${item.artwork.title || item.artwork.id}"`,
            );
            return {
              description: buildCustomsCommodityDescription({
                title: item.artwork.title,
                support: item.artwork.support,
              }),
              quantity: qty,
              weightLb: Number((weightKg * 2.20462 * qty).toFixed(2)),
              unitPrice: Number(item.price ?? item.artwork.desiredPrice ?? 0),
              currency: "USD",
              // Seller ship-from country — not Artwork.origin provenance.
              countryOfManufacture: senderCountry.toUpperCase(),
            };
          }),
        });
      }

      const payload = {
        labelResponseOptions: "LABEL",
        requestedShipment,
        accountNumber: {
          value: fedexAccountNumber,
        },
      };

      const response = await axios.post(
        `${this.apiUrl}/ship/v1/shipments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-locale": "en_US",
            "x-customer-transaction-id": customerTransactionId,
          },
        },
      );

      const transactionShipment =
        response.data?.output?.transactionShipments?.[0];
      if (!transactionShipment) {
        throw new InternalServerErrorException(
          "FedEx did not return a shipment in the create-shipment response",
        );
      }

      const pieceResponse = transactionShipment.pieceResponses?.[0];
      trackingNumber = pieceResponse?.trackingNumber;
      masterTrackingId =
        transactionShipment.masterTrackingNumber || trackingNumber;

      if (!trackingNumber) {
        throw new InternalServerErrorException(
          "FedEx did not return a tracking number",
        );
      }

      const extractedLabel = await this.extractShippingLabel(
        transactionShipment,
        pieceResponse,
      );
      if (!extractedLabel) {
        const docSummary = this.summarizeFedExDocuments(transactionShipment);
        this.logger.error(
          `FedEx shipment ${trackingNumber} created but no label payload found. Documents: ${docSummary}`,
        );
        throw new InternalServerErrorException(
          "FedEx created the shipment but did not return a shipping label. Retry once; if it keeps failing, contact support with the tracking number.",
        );
      }

      const fileName = `label-${trackingNumber}.${extractedLabel.extension}`;
      const uploadResult = await this.s3Service.uploadBuffer(
        extractedLabel.buffer,
        fileName,
        extractedLabel.mimeType,
      );
      labelUrl = uploadResult.publicUrl;

      this.logger.log(
        `Successfully generated and uploaded FedEx label to S3: ${labelUrl}`,
      );
    } catch (error: any) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const fedexError = formatFedExApiErrors(
        error?.response?.data ?? error?.message,
      );

      this.logger.error(
        `Failed to create FedEx shipment for order ${orderId}, artist ${artistId}: ${fedexError}`,
      );

      const status = error?.response?.status;
      const message =
        typeof fedexError === "string"
          ? `Failed to create FedEx shipment: ${fedexError}`
          : "Failed to create FedEx shipment";

      // FedEx input/validation problems are client-fixable (400), not opaque 500s.
      if (status === 400 || String(fedexError).includes("INVALID.INPUT")) {
        throw new BadRequestException(message);
      }

      throw new InternalServerErrorException(message);
    }

    this.logger.log(
      `Created FedEx shipment for order ${orderId}, artist ${artistId}: ${trackingNumber}`,
    );

    const existing = await this.prisma.shipment.findFirst({
      where: { orderId, artistId },
    });

    const shipmentData = {
      trackingNumber,
      masterTrackingId,
      labelUrl,
      serviceType,
      status: "LABEL_CREATED" as const,
      failureReason: null,
    };

    const eventCreate = {
      status: "LABEL_CREATED" as const,
      description: "Shipping label created",
      timestamp: new Date(),
    };

    const shipment = existing
      ? await this.prisma.shipment.update({
          where: { id: existing.id },
          data: {
            ...shipmentData,
            events: { create: [eventCreate] },
          },
        })
      : await this.prisma.shipment.create({
          data: {
            orderId,
            artistId,
            ...shipmentData,
            events: { create: [eventCreate] },
          },
        });

    return { success: true, shipment };
  }

  async getArtistShipments(artistId: string) {
    const shipments = await this.prisma.shipment.findMany({
      where: { artistId },
      include: {
        order: true,
        events: { orderBy: { timestamp: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return shipments.map(withLifecycleFilteredEvents);
  }

  async getOrderShipments(buyerId: string, orderId: string) {
    // Make sure order belongs to buyer
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (order?.userId !== buyerId && order?.buyerEmail) {
      // logic to verify email if guest
    }
    const shipments = await this.prisma.shipment.findMany({
      where: { orderId },
      include: { events: { orderBy: { timestamp: "desc" } } },
    });
    return shipments.map(withLifecycleFilteredEvents);
  }

  /**
   * FedEx returns labels under packageDocuments and/or shipmentDocuments.
   * contentType may be "PDF" or "application/pdf"; docType varies by account.
   * Some responses return a temporary URL instead of base64.
   */
  private async extractShippingLabel(
    transactionShipment: any,
    pieceResponse: any,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    extension: string;
  } | null> {
    const candidates: any[] = [
      ...(pieceResponse?.packageDocuments || []),
      ...(transactionShipment?.shipmentDocuments || []),
      ...(transactionShipment?.pieceResponses || []).flatMap(
        (piece: any) => piece?.packageDocuments || [],
      ),
    ];

    const withPayload = candidates.find(
      (doc) =>
        typeof doc?.encodedLabel === "string" && doc.encodedLabel.length > 0,
    );
    if (withPayload) {
      const { mimeType, extension } = this.labelMimeFromDoc(withPayload);
      return {
        buffer: Buffer.from(withPayload.encodedLabel, "base64"),
        mimeType,
        extension,
      };
    }

    const withUrl = candidates.find(
      (doc) => typeof doc?.url === "string" && doc.url.length > 0,
    );
    if (withUrl?.url) {
      try {
        const labelResponse = await axios.get(withUrl.url, {
          responseType: "arraybuffer",
          timeout: 20000,
        });
        const { mimeType, extension } = this.labelMimeFromDoc(withUrl);
        return {
          buffer: Buffer.from(labelResponse.data),
          mimeType,
          extension,
        };
      } catch (err: any) {
        this.logger.error(
          `Failed to download FedEx label URL: ${err?.message || err}`,
        );
        return null;
      }
    }

    return null;
  }

  private labelMimeFromDoc(doc: any): { mimeType: string; extension: string } {
    const rawType = String(
      doc?.contentType || doc?.docType || "PDF",
    ).toUpperCase();
    if (rawType.includes("PNG")) {
      return { mimeType: "image/png", extension: "png" };
    }
    if (rawType.includes("ZPL")) {
      return { mimeType: "application/octet-stream", extension: "zpl" };
    }
    return { mimeType: "application/pdf", extension: "pdf" };
  }

  private summarizeFedExDocuments(transactionShipment: any): string {
    const pieces = transactionShipment?.pieceResponses || [];
    const packageDocs = pieces.flatMap((p: any) => p?.packageDocuments || []);
    const shipmentDocs = transactionShipment?.shipmentDocuments || [];
    const describe = (docs: any[]) =>
      docs.map((d) => ({
        docType: d?.docType,
        contentType: d?.contentType,
        hasEncodedLabel: Boolean(d?.encodedLabel),
        hasUrl: Boolean(d?.url),
      }));

    return JSON.stringify({
      alerts: transactionShipment?.alerts,
      packageDocuments: describe(packageDocs),
      shipmentDocuments: describe(shipmentDocs),
      keys: Object.keys(transactionShipment || {}),
    });
  }
}
