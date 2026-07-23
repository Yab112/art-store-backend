import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

export type FxPair = { base: "USD"; quote: "ETB" };

export interface LiveRateResult {
  base: "USD";
  quote: "ETB";
  rate: number;
  fetchedAt: string;
  source: string;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cache: { rate: number; fetchedAt: number; source: string } | null =
    null;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Live USD → ETB mid-market rate (cached briefly).
   * Used by CheckoutPricingService to calculate Chapa ChargeQuote amounts.
   * Reporting endpoint also uses this — reporting must not drive payment init.
   */
  async getUsdToEtb(): Promise<LiveRateResult> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.cacheTtlMs) {
      return {
        base: "USD",
        quote: "ETB",
        rate: this.cache.rate,
        fetchedAt: new Date(this.cache.fetchedAt).toISOString(),
        source: this.cache.source,
      };
    }

    const providers: Array<{
      source: string;
      fetch: () => Promise<number>;
    }> = [
      {
        source: "open.er-api.com",
        fetch: async () => {
          const res = await fetch("https://open.er-api.com/v6/latest/USD", {
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const rate = Number(data?.rates?.ETB);
          if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error("ETB rate missing");
          }
          return rate;
        },
      },
      {
        source: "fawazahmed0/currency-api",
        fetch: async () => {
          const res = await fetch(
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
            { signal: AbortSignal.timeout(8000) },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const rate = Number(data?.usd?.etb);
          if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error("ETB rate missing");
          }
          return rate;
        },
      },
    ];

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const rate = await provider.fetch();
        this.cache = { rate, fetchedAt: now, source: provider.source };
        this.logger.log(
          `USD→ETB rate ${rate} from ${provider.source}`,
        );
        return {
          base: "USD",
          quote: "ETB",
          rate,
          fetchedAt: new Date(now).toISOString(),
          source: provider.source,
        };
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `FX provider ${provider.source} failed: ${(err as Error)?.message}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `Unable to fetch live USD→ETB rate: ${
        (lastError as Error)?.message || "all providers failed"
      }`,
    );
  }
}
