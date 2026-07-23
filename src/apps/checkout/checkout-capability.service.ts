import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { BalanceService } from "../balance/balance.service";

export type PaymentProviderId = "paypal" | "chapa";
export type ChargeCurrency = "USD" | "ETB";
export type PayoutSupport = "full" | "sendOnly" | "unsupported";

/** Provider settlement / charge currency for MVP rails (no marketplace FX). */
export const PROVIDER_CHARGE_CURRENCY: Record<PaymentProviderId, ChargeCurrency> =
  {
    paypal: "USD",
    chapa: "ETB",
  };

export const PROVIDER_SETTLEMENT_CURRENCY: Record<
  PaymentProviderId,
  ChargeCurrency
> = {
  paypal: "USD",
  chapa: "ETB",
};

export interface ResolveCheckoutInput {
  buyerId: string | null;
  sellerIds: string[];
  /** Canonical listing currency for the order (all line items must share it). */
  listingCurrency: ChargeCurrency;
  /** Optional buyer region hints for payment capability (e.g. address country). */
  buyerCountry?: string | null;
}

export interface ResolveCheckoutResult {
  availableMethods: PaymentProviderId[];
  buyerCapabilities: PaymentProviderId[];
  sellerCapabilities: PaymentProviderId[];
  listingCurrency: ChargeCurrency;
  compatible: boolean;
  reason?: string;
}

@Injectable()
export class CheckoutCapabilityService {
  private readonly logger = new Logger(CheckoutCapabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  /**
   * Buyer payment capabilities.
   * MVP: PayPal always; Chapa when buyer is in Ethiopia (ET) or country unknown (allow attempt).
   * Checkout does not know *why* — only the resulting set.
   */
  async getBuyerPaymentCapabilities(
    buyerId: string | null,
    buyerCountry?: string | null,
  ): Promise<PaymentProviderId[]> {
    const caps = new Set<PaymentProviderId>(["paypal"]);

    let country = (buyerCountry || "").trim().toUpperCase();
    if (!country && buyerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: buyerId },
        select: { addressCountry: true },
      });
      country = String(user?.addressCountry || "")
        .trim()
        .toUpperCase();
    }

    // Chapa local rails — treat ET / ETH / Ethiopia as eligible
    if (!country || country === "ET" || country === "ETH" || country === "ETHIOPIA") {
      caps.add("chapa");
    }

    return Array.from(caps);
  }

  /** Validated seller payout capabilities (full support only). */
  async getSellerPayoutCapabilities(
    sellerId: string,
  ): Promise<PaymentProviderId[]> {
    const rows = await this.prisma.sellerPayoutCapability.findMany({
      where: { userId: sellerId, payoutSupport: "full" },
      select: { provider: true },
    });
    return rows
      .map((r) => String(r.provider).toLowerCase())
      .filter((p): p is PaymentProviderId => p === "paypal" || p === "chapa");
  }

  /**
   * Single addressable resolution function (architecture doc).
   * MVP: intersection of buyer ∩ seller capabilities.
   * Listing currency is always USD; charge currency comes from ChargeQuote later.
   * Corridor-specific rules can be added here later without changing call sites.
   */
  async resolveCheckoutMethods(
    input: ResolveCheckoutInput,
  ): Promise<ResolveCheckoutResult> {
    const listingCurrency = input.listingCurrency;
    if (listingCurrency !== "USD" && listingCurrency !== "ETB") {
      throw new BadRequestException(
        "listingCurrency must be USD or ETB",
      );
    }

    const buyerCapabilities = await this.getBuyerPaymentCapabilities(
      input.buyerId,
      input.buyerCountry,
    );

    if (!input.sellerIds.length) {
      return {
        availableMethods: [],
        buyerCapabilities,
        sellerCapabilities: [],
        listingCurrency,
        compatible: false,
        reason: "No sellers on this order",
      };
    }

    const perSeller = await Promise.all(
      input.sellerIds.map((id) => this.getSellerPayoutCapabilities(id)),
    );

    // Intersection across all sellers
    let sellerCapabilities = perSeller[0] || [];
    for (let i = 1; i < perSeller.length; i++) {
      const set = new Set(perSeller[i]);
      sellerCapabilities = sellerCapabilities.filter((p) => set.has(p));
    }

    const buyerSet = new Set(buyerCapabilities);
    const sellerSet = new Set(sellerCapabilities);

    // Listing is always USD; rail eligibility is buyer ∩ seller only.
    // Charge currency is determined later by CheckoutPricingService (USD or ETB).
    let availableMethods = (["paypal", "chapa"] as PaymentProviderId[]).filter(
      (p) => buyerSet.has(p) && sellerSet.has(p),
    );

    // Hook for future corridor rules (sanctions / provider policy) — MVP: no-op
    availableMethods = this.applyCorridorRules(availableMethods, input);

    const compatible = availableMethods.length > 0;
    return {
      availableMethods,
      buyerCapabilities,
      sellerCapabilities,
      listingCurrency,
      compatible,
      reason: compatible
        ? undefined
        : "No compatible payment method for this buyer/seller/listing combination",
    };
  }

  private applyCorridorRules(
    methods: PaymentProviderId[],
    _input: ResolveCheckoutInput,
  ): PaymentProviderId[] {
    return methods;
  }

  /**
   * Resolve methods for a set of artwork IDs (cart selection).
   */
  async resolveForArtworks(params: {
    buyerId: string | null;
    artworkIds: string[];
    buyerCountry?: string | null;
  }): Promise<
    ResolveCheckoutResult & {
      sellerIds: string[];
    }
  > {
    const artworks = await this.prisma.artwork.findMany({
      where: { id: { in: params.artworkIds } },
      select: { id: true, userId: true, listingCurrency: true },
    });

    if (artworks.length !== params.artworkIds.length) {
      throw new BadRequestException("One or more artworks not found");
    }

    const currencies = new Set(
      artworks.map((a) =>
        String((a as any).listingCurrency || "USD")
          .trim()
          .toUpperCase(),
      ),
    );
    const nonUsd = [...currencies].filter((c) => c && c !== "USD");
    if (nonUsd.length > 0) {
      return {
        availableMethods: [],
        buyerCapabilities: await this.getBuyerPaymentCapabilities(
          params.buyerId,
          params.buyerCountry,
        ),
        sellerCapabilities: [],
        listingCurrency: "USD",
        compatible: false,
        reason:
          "All artworks must be listed in USD. Re-list non-USD items before checkout.",
        sellerIds: [...new Set(artworks.map((a) => a.userId))],
      };
    }

    const listingCurrency = "USD" as ChargeCurrency;
    const sellerIds = [...new Set(artworks.map((a) => a.userId))];
    const resolved = await this.resolveCheckoutMethods({
      buyerId: params.buyerId,
      sellerIds,
      listingCurrency,
      buyerCountry: params.buyerCountry,
    });
    return { ...resolved, sellerIds };
  }

  // ─── Seller payout setup (capability records) ─────────────────────

  async listSellerPayoutCapabilities(userId: string) {
    return this.prisma.sellerPayoutCapability.findMany({
      where: { userId },
      orderBy: { connectedAt: "asc" },
    });
  }

  /**
   * Connect a payout provider. MVP treats successful account details as payoutSupport=full.
   * Real provider account-status checks can replace the heuristic later without changing checkout.
   */
  async connectSellerPayout(
    userId: string,
    provider: PaymentProviderId,
    details: {
      paypalEmail?: string;
      chapaAccountName?: string;
      chapaAccountNumber?: string;
      chapaBankCode?: string;
    },
  ) {
    if (provider === "paypal") {
      if (!details.paypalEmail?.trim()) {
        throw new BadRequestException("PayPal email is required to connect PayPal payouts");
      }
    }
    if (provider === "chapa") {
      if (
        !details.chapaAccountName?.trim() ||
        !details.chapaAccountNumber?.trim() ||
        !details.chapaBankCode?.trim()
      ) {
        throw new BadRequestException(
          "Chapa account name, number, and bank code are required",
        );
      }
    }

    // MVP eligibility: allow connect as full (provider-specific KYC can tighten later)
    const payoutSupport: PayoutSupport = "full";

    const row = await this.prisma.sellerPayoutCapability.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        payoutSupport,
        paypalEmail: details.paypalEmail?.trim() || null,
        chapaAccountName: details.chapaAccountName?.trim() || null,
        chapaAccountNumber: details.chapaAccountNumber?.trim() || null,
        chapaBankCode: details.chapaBankCode?.trim() || null,
      },
      update: {
        payoutSupport,
        paypalEmail: details.paypalEmail?.trim() || null,
        chapaAccountName: details.chapaAccountName?.trim() || null,
        chapaAccountNumber: details.chapaAccountNumber?.trim() || null,
        chapaBankCode: details.chapaBankCode?.trim() || null,
        updatedAt: new Date(),
      },
    });

    // Keep legacy preference row in sync for older UI paths
    await this.syncLegacyPreference(userId);

    this.logger.log(`Seller ${userId} connected payout capability: ${provider}`);
    return row;
  }

  async disconnectSellerPayout(userId: string, provider: PaymentProviderId) {
    const existing = await this.prisma.sellerPayoutCapability.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!existing) {
      throw new NotFoundException(`No ${provider} payout capability to disconnect`);
    }

    const { available, reservedPending, reservedDisputed } =
      await this.balanceService.getWithdrawable(userId, provider);
    const blocked = available > 0 || reservedPending > 0 || reservedDisputed > 0;
    if (blocked) {
      throw new BadRequestException(
        `Cannot disconnect ${provider} while it holds pending or withdrawable balance. Withdraw to zero first.`,
      );
    }

    await this.prisma.sellerPayoutCapability.delete({
      where: { userId_provider: { userId, provider } },
    });
    await this.syncLegacyPreference(userId);
    this.logger.log(`Seller ${userId} disconnected payout capability: ${provider}`);
    return { success: true };
  }

  private async syncLegacyPreference(userId: string) {
    const caps = await this.listSellerPayoutCapabilities(userId);
    const paypal = caps.find((c) => c.provider === "paypal");
    const chapa = caps.find((c) => c.provider === "chapa");
    const method = paypal ? "paypal" : chapa ? "chapa" : "paypal";
    await this.prisma.paymentMethodPreference.upsert({
      where: { userId },
      create: {
        userId,
        method,
        isDefault: true,
        paypalEmail: paypal?.paypalEmail || null,
        chapaAccountName: chapa?.chapaAccountName || null,
        chapaAccountNumber: chapa?.chapaAccountNumber || null,
        chapaBankCode: chapa?.chapaBankCode || null,
      },
      update: {
        method,
        paypalEmail: paypal?.paypalEmail || null,
        chapaAccountName: chapa?.chapaAccountName || null,
        chapaAccountNumber: chapa?.chapaAccountNumber || null,
        chapaBankCode: chapa?.chapaBankCode || null,
      },
    });
  }
}
