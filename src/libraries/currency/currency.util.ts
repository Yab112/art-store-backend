/** Explicit charge currencies supported today. Independent of paymentProvider. */
export type ChargeCurrency = "USD" | "ETB";

export function normalizeCurrency(value: unknown): ChargeCurrency | null {
  const c = String(value || "")
    .trim()
    .toUpperCase();
  if (c === "USD" || c === "ETB") return c;
  return null;
}

/**
 * FedEx service type codes (API often omits the FEDEX_ prefix, e.g. PRIORITY_OVERNIGHT).
 * Keep in sync with gallery `isFedExServiceType`.
 */
const FEDEX_SERVICE_TYPES = new Set([
  "PRIORITY_OVERNIGHT",
  "STANDARD_OVERNIGHT",
  "FIRST_OVERNIGHT",
  "FEDEX_2_DAY",
  "FEDEX_2_DAY_AM",
  "FEDEX_EXPRESS_SAVER",
  "FEDEX_GROUND",
  "GROUND_HOME_DELIVERY",
  "INTERNATIONAL_PRIORITY",
  "INTERNATIONAL_ECONOMY",
  "INTERNATIONAL_FIRST",
  "INTERNATIONAL_PRIORITY_EXPRESS",
  "FEDEX_INTERNATIONAL_PRIORITY",
  "FEDEX_INTERNATIONAL_PRIORITY_EXPRESS",
  "FEDEX_INTERNATIONAL_CONNECT_PLUS",
  "INTERNATIONAL_ECONOMY_FREIGHT",
  "INTERNATIONAL_PRIORITY_FREIGHT",
  "EUROPE_FIRST_INTERNATIONAL_PRIORITY",
  "FEDEX_FREIGHT_PRIORITY",
  "FEDEX_FREIGHT_ECONOMY",
  "SMART_POST",
  "FEDEX_SMART_POST",
]);

export type ShippingIdentity = {
  serviceType?: unknown;
  serviceName?: unknown;
};

/**
 * True when the selected shipping option is FedEx (USD international rail).
 * Checks serviceType codes AND serviceName — FedEx Priority Overnight is
 * often typed as PRIORITY_OVERNIGHT (no "FEDEX" substring).
 */
export function isFedExServiceType(
  serviceTypeOrOption: unknown,
  serviceName?: unknown,
): boolean {
  let type = "";
  let name = "";

  if (
    serviceTypeOrOption &&
    typeof serviceTypeOrOption === "object" &&
    !Array.isArray(serviceTypeOrOption)
  ) {
    const o = serviceTypeOrOption as ShippingIdentity;
    type = String(o.serviceType || "")
      .trim()
      .toUpperCase();
    name = String(o.serviceName || "")
      .trim()
      .toUpperCase();
  } else {
    type = String(serviceTypeOrOption || "")
      .trim()
      .toUpperCase();
    name = String(serviceName || "")
      .trim()
      .toUpperCase();
  }

  if (!type && !name) return false;
  if (type.includes("FEDEX") || name.includes("FEDEX")) return true;
  if (FEDEX_SERVICE_TYPES.has(type)) return true;
  // Common FedEx codes without FEDEX_ prefix
  if (
    type.includes("OVERNIGHT") ||
    type.startsWith("INTERNATIONAL_") ||
    type === "GROUND_HOME_DELIVERY" ||
    type === "SMART_POST"
  ) {
    return true;
  }
  return false;
}

/**
 * Format for UI/email only. Never persist the result.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  const n = typeof amount === "string" ? Number(amount) : Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const code = String(currency || "")
    .trim()
    .toUpperCase();

  if (code === "ETB") {
    return `ETB ${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Default presentation for USD and unknown → $ (callers should pass currency)
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
