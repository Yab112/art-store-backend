import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ExchangeRateService } from "../../libraries/currency/exchange-rate.service";
import {
  ChargeQuote,
  CHARGE_QUOTE_TTL_MS,
  isChargeQuoteExpired,
  newQuoteId,
  QuotePricingInput,
  roundMoney,
} from "./checkout-pricing.types";

/**
 * Canonical checkout pricing: builds an immutable ChargeQuote.
 * Marketplace calculates the gateway charge amount; it does not move FX funds.
 */
@Injectable()
export class CheckoutPricingService {
  private readonly logger = new Logger(CheckoutPricingService.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  async createQuote(input: QuotePricingInput): Promise<ChargeQuote> {
    const listingUsd = roundMoney(Number(input.listingUsd) || 0);
    const shippingUsd = roundMoney(Number(input.shippingUsd) || 0);
    if (listingUsd < 0 || shippingUsd < 0) {
      throw new BadRequestException("Amounts must be non-negative");
    }
    if (listingUsd <= 0 && shippingUsd <= 0) {
      throw new BadRequestException("Order total must be greater than zero");
    }

    const feeUsd = roundMoney(
      listingUsd * (Number(input.platformCommissionRate) || 0),
    );
    const totalUsd = roundMoney(listingUsd + shippingUsd);
    const lockedAt = new Date();
    const expiresAt = new Date(lockedAt.getTime() + CHARGE_QUOTE_TTL_MS);
    const quoteId = newQuoteId();

    if (input.provider === "paypal") {
      return {
        quoteId,
        provider: "paypal",
        listingUsd,
        shippingUsd,
        feeUsd,
        totalUsd,
        fxRate: null,
        fxSource: null,
        lockedAt: lockedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        chargedCurrency: "USD",
        chargedAmount: totalUsd,
      };
    }

    if (input.provider === "chapa") {
      const live = await this.exchangeRateService.getUsdToEtb();
      const fxRate = Number(live.rate);
      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        throw new BadRequestException("Invalid USD→ETB rate");
      }
      const chargedAmount = roundMoney(totalUsd * fxRate);
      this.logger.log(
        `Chapa quote ${quoteId}: ${totalUsd} USD → ${chargedAmount} ETB @ ${fxRate} (${live.source})`,
      );
      return {
        quoteId,
        provider: "chapa",
        listingUsd,
        shippingUsd,
        feeUsd,
        totalUsd,
        fxRate,
        fxSource: live.source,
        lockedAt: lockedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        chargedCurrency: "ETB",
        chargedAmount,
      };
    }

    throw new BadRequestException(`Unsupported provider: ${input.provider}`);
  }

  /** Fail closed if quote missing or past expiresAt. */
  assertQuoteUsable(quote: ChargeQuote | null | undefined): ChargeQuote {
    if (!quote?.quoteId || !quote.chargedCurrency || quote.chargedAmount == null) {
      throw new BadRequestException("Charge quote is missing");
    }
    if (isChargeQuoteExpired(quote)) {
      throw new BadRequestException({
        statusCode: 400,
        error: "QUOTE_EXPIRED",
        message:
          "This payment quote has expired. Please refresh checkout to get an updated amount.",
      });
    }
    if (
      !Number.isFinite(Number(quote.chargedAmount)) ||
      Number(quote.chargedAmount) <= 0
    ) {
      throw new BadRequestException("Invalid charged amount on quote");
    }
    return quote;
  }

  parseQuoteFromMetadata(metadata: unknown): ChargeQuote | null {
    const m = (metadata || {}) as any;
    const q = m.chargeQuote || m.charge_quote;
    if (!q || typeof q !== "object") return null;
    return q as ChargeQuote;
  }
}
