import { randomUUID } from "crypto";

export type PaymentProviderId = "paypal" | "chapa";
export type ChargeCurrency = "USD" | "ETB";

/** Immutable checkout price the gateway must collect. */
export interface ChargeQuote {
  quoteId: string;
  provider: PaymentProviderId;
  /** Artwork merchandise subtotal in USD */
  listingUsd: number;
  /** Shipping in USD (S1 — logistics always USD) */
  shippingUsd: number;
  /** Platform fee in USD (informational; included in totalUsd) */
  feeUsd: number;
  /** listingUsd + shippingUsd (buyer-facing order total in USD) */
  totalUsd: number;
  /** Locked USD→ETB rate; null for PayPal */
  fxRate: number | null;
  fxSource: string | null;
  lockedAt: string;
  expiresAt: string;
  chargedCurrency: ChargeCurrency;
  /** Amount the payment provider collects */
  chargedAmount: number;
}

export interface QuotePricingInput {
  provider: PaymentProviderId;
  listingUsd: number;
  shippingUsd: number;
  /** Platform commission rate 0–1 applied to listingUsd only */
  platformCommissionRate: number;
}

/** MVP: quotes expire after 15 minutes — buyer must refresh. */
export const CHARGE_QUOTE_TTL_MS = 15 * 60 * 1000;

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toMinorUnits(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function newQuoteId(): string {
  return randomUUID();
}

export function isChargeQuoteExpired(
  quote: Pick<ChargeQuote, "expiresAt">,
  now = new Date(),
): boolean {
  const expires = new Date(quote.expiresAt).getTime();
  if (!Number.isFinite(expires)) return true;
  return now.getTime() > expires;
}
