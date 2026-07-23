import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import postalCodes from "postal-codes-js";
import { State } from "country-state-city";

/** FedEx tracking numbers are numeric and typically 12 or 15 digits. */
export function isValidFedExTrackingNumber(trackingNumber: string): boolean {
  return /^\d{12,15}$/.test(trackingNumber?.trim() ?? "");
}

export function getRequiredFedExAccountNumber(
  configService: { get: (key: string) => string | undefined },
): string {
  const accountNumber = configService.get("FEDEX_ACCOUNT_NUMBER")?.trim();
  if (!accountNumber) {
    throw new InternalServerErrorException(
      "FedEx account number is not configured",
    );
  }
  return accountNumber;
}

/** Platform-wide HS / HTS code for international art shipments (6–10 digits). */
export function getRequiredFedExDefaultHsCode(
  configService: { get: (key: string) => string | undefined },
): string {
  const raw = configService.get("FEDEX_DEFAULT_HS_CODE")?.trim() ?? "";
  const hs = raw.replace(/\D/g, "");
  if (!/^\d{6,10}$/.test(hs)) {
    throw new InternalServerErrorException(
      "FEDEX_DEFAULT_HS_CODE is missing or invalid (expected 6–10 digits, e.g. 970190)",
    );
  }
  return hs;
}

/**
 * FedEx may return transitDays as a number, numeric string, enum
 * ("THREE_DAYS"), or a min/max object — normalize to a day count for UI.
 */
export function normalizeFedExTransitDays(raw: unknown): number | null {
  if (raw == null) return null;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asInt = parseInt(trimmed, 10);
    if (Number.isFinite(asInt) && asInt > 0) return asInt;

    const enumMatch = trimmed.toUpperCase().match(/^([A-Z]+)_DAYS?$/);
    const WORD_TO_NUM: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
      SIX: 6,
      SEVEN: 7,
      EIGHT: 8,
      NINE: 9,
      TEN: 10,
    };
    if (enumMatch && WORD_TO_NUM[enumMatch[1]]) {
      return WORD_TO_NUM[enumMatch[1]];
    }
    return null;
  }

  // Arrays (e.g. commitDays: ["FRI"]) are not day counts.
  if (Array.isArray(raw)) return null;

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const max = normalizeFedExTransitDays(
      obj.maximum ?? obj.max ?? obj.maxTransitDays ?? obj.maxTransitTime,
    );
    if (max != null) return max;
    const min = normalizeFedExTransitDays(
      obj.minimum ?? obj.min ?? obj.minTransitDays ?? obj.minTransitTime,
    );
    if (min != null) return min;
    if ("value" in obj) return normalizeFedExTransitDays(obj.value);
    if ("description" in obj) return normalizeFedExTransitDays(obj.description);
    if ("transitTime" in obj) return normalizeFedExTransitDays(obj.transitTime);
    if ("transitDays" in obj) return normalizeFedExTransitDays(obj.transitDays);
  }

  return null;
}

export function isInternationalLane(
  originCountry?: string | null,
  destinationCountry?: string | null,
): boolean {
  const origin = (originCountry || "").trim().toUpperCase();
  const destination = (destinationCountry || "").trim().toUpperCase();
  return Boolean(origin && destination && origin !== destination);
}

const VAGUE_ARTWORK_TITLES = new Set([
  "",
  "untitled",
  "n/a",
  "na",
  "none",
  "test",
  "artwork",
  "original artwork",
]);

/**
 * FedEx commodity description (max 450). Prefer a real title; otherwise
 * "Original artwork" plus optional support medium.
 */
export function buildCustomsCommodityDescription(params: {
  title?: string | null;
  support?: string | null;
}): string {
  const title = (params.title || "").replace(/\s+/g, " ").trim();
  const support = (params.support || "").replace(/\s+/g, " ").trim();
  const titleKey = title.toLowerCase();

  let description: string;
  if (title && !VAGUE_ARTWORK_TITLES.has(titleKey)) {
    description = title;
  } else if (support) {
    description = `Original artwork — ${support}`;
  } else {
    description = "Original artwork";
  }

  return description.slice(0, 450);
}

export type FedExCustomsCommodityInput = {
  description: string;
  quantity: number;
  weightLb: number;
  unitPrice: number;
  currency?: string;
  /**
   * ISO country of manufacture. Use the seller ship-from country — not
   * Artwork.origin (that field is provenance free-text / enum, not ISO CoM).
   */
  countryOfManufacture: string;
};

/**
 * FedEx requires customsClearanceDetail for international (and some intra-country)
 * rate quotes and ship requests. RATE.CUSTOMCLEARANCEDETAIL.INVALID means it was missing.
 * Duties stay SENDER (platform shipper account) for this phase.
 */
export function buildCustomsClearanceDetail(params: {
  accountNumber: string;
  /** Platform default HS for all art commodities (required for international). */
  harmonizedCode: string;
  commodities: FedExCustomsCommodityInput[];
}): {
  dutiesPayment: {
    paymentType: "SENDER";
    payor: { responsibleParty: { accountNumber: { value: string } } };
  };
  isDocumentOnly: false;
  commercialInvoice: { shipmentPurpose: "SOLD" };
  commodities: Array<Record<string, unknown>>;
  totalCustomsValue: { amount: number; currency: string };
} {
  if (!params.commodities.length) {
    throw new BadRequestException(
      "International FedEx shipments require at least one customs commodity",
    );
  }

  const hs = String(params.harmonizedCode || "").replace(/\D/g, "");
  if (!/^\d{6,10}$/.test(hs)) {
    throw new InternalServerErrorException(
      "Invalid harmonizedCode for FedEx customs (expected 6–10 digits)",
    );
  }

  const commodities = params.commodities.map((item) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitAmount = Number(item.unitPrice);
    if (!Number.isFinite(unitAmount) || unitAmount < 0) {
      throw new BadRequestException(
        `Customs commodity "${item.description}" needs a valid unit price`,
      );
    }
    const weightValue = Number(Number(item.weightLb).toFixed(2));
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      throw new BadRequestException(
        `Customs commodity "${item.description}" needs a valid weight`,
      );
    }
    const currency = (item.currency || "USD").toUpperCase();
    const lineAmount = Number((unitAmount * quantity).toFixed(2));
    const description = (item.description || "Original artwork")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 450);
    const countryOfManufacture = item.countryOfManufacture.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryOfManufacture)) {
      throw new BadRequestException(
        "Customs country of manufacture must be a 2-letter ISO country code",
      );
    }

    return {
      description: description || "Original artwork",
      countryOfManufacture,
      harmonizedCode: hs,
      quantity,
      quantityUnits: "EA",
      weight: {
        units: "LB",
        value: weightValue,
      },
      unitPrice: {
        amount: Number(unitAmount.toFixed(2)),
        currency,
      },
      customsValue: {
        amount: lineAmount,
        currency,
      },
    };
  });

  const currency = String(commodities[0].customsValue.currency || "USD");
  const totalAmount = Number(
    commodities
      .reduce((sum, c) => sum + Number(c.customsValue.amount), 0)
      .toFixed(2),
  );

  return {
    dutiesPayment: {
      paymentType: "SENDER",
      payor: {
        responsibleParty: {
          accountNumber: { value: params.accountNumber },
        },
      },
    },
    isDocumentOnly: false,
    commercialInvoice: {
      shipmentPurpose: "SOLD",
    },
    commodities,
    totalCustomsValue: {
      amount: totalAmount,
      currency,
    },
  };
}

export function parseWeightKg(
  rawWeight: string | null | undefined,
  context: string,
): number {
  const weightStr = rawWeight?.toString().replace(/[^0-9.]/g, "") ?? "";
  const weightKg = parseFloat(weightStr);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new BadRequestException(
      `${context}: a valid artwork weight is required for FedEx`,
    );
  }
  return weightKg;
}

export function parseDimensionsInches(
  dimensions: unknown,
  context: string,
): { length: number; width: number; height: number } {
  let record: Record<string, unknown>;

  if (typeof dimensions === "string") {
    try {
      const parsed = JSON.parse(dimensions);
      if (!parsed || typeof parsed !== "object") {
        throw new BadRequestException(
          `${context}: artwork dimensions are required for FedEx`,
        );
      }
      record = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `${context}: artwork dimensions are invalid`,
      );
    }
  } else if (dimensions && typeof dimensions === "object") {
    record = dimensions as Record<string, unknown>;
  } else {
    throw new BadRequestException(
      `${context}: artwork dimensions are required for FedEx`,
    );
  }

  const heightCm = parseFloat(String(record.height ?? ""));
  const widthCm = parseFloat(String(record.width ?? ""));
  const depthCm = parseFloat(String(record.depth ?? ""));

  if (
    !Number.isFinite(heightCm) ||
    heightCm <= 0 ||
    !Number.isFinite(widthCm) ||
    widthCm <= 0 ||
    !Number.isFinite(depthCm) ||
    depthCm <= 0
  ) {
    throw new BadRequestException(
      `${context}: valid artwork height, width, and depth are required for FedEx`,
    );
  }

  const cmToIn = (value: number) => Math.max(1, Math.ceil(value / 2.54));

  return {
    length: cmToIn(Math.max(heightCm, widthCm)),
    width: cmToIn(Math.min(heightCm, widthCm)),
    height: cmToIn(depthCm),
  };
}

export type ArtistShippingProfile = {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipCode?: string | null;
  addressCountry?: string | null;
  addressPhone?: string | null;
};

export type AddressLike = {
  fullName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
};

/**
 * Phone / postal formats come from maintained libraries (libphonenumber-js,
 * postal-codes-js). Subdivision requirement comes from country-state-city.
 * FedEx service availability is decided by the Rate API — not listed here.
 */

export function countryRequiresState(country?: string | null): boolean {
  const code = (country || "").trim().toUpperCase();
  if (!code) return false;
  // country-state-city includes counties for some countries (e.g. GB).
  // Treat as required only when the subdivision list looks like regions/states.
  const count = State.getStatesOfCountry(code).length;
  return count > 0 && count <= 80;
}

export function countrySupportsPostalPlaceLookup(
  country?: string | null,
): boolean {
  // Zippopotam coverage is discovered at request time (see lookupPostalPlace).
  return Boolean((country || "").trim());
}

/** Shared shippable-origin checks used by Settings, artwork submit, rates, and label create. */
export function getArtistShippingProfileIssues(
  artist: ArtistShippingProfile,
): string[] {
  const issues: string[] = [];
  const country = artist.addressCountry?.trim().toUpperCase() ?? "";

  if (!artist.name?.trim()) issues.push("display name is required");
  if (!artist.addressLine1?.trim()) issues.push("address line 1 is required");
  if (!artist.addressCity?.trim()) issues.push("city is required");
  if (!artist.addressZipCode?.trim()) issues.push("postal/ZIP code is required");
  if (!country) issues.push("country is required");
  if (!artist.addressPhone?.trim()) issues.push("contact phone is required");

  if (country && countryRequiresState(country) && !artist.addressState?.trim()) {
    issues.push(`state/province is required for ${country}`);
  }

  if (country && artist.addressZipCode?.trim()) {
    const postalIssue = getPostalCodeIssue(artist.addressZipCode, country);
    if (postalIssue) issues.push(postalIssue);
  }

  if (country && artist.addressPhone?.trim()) {
    const phoneIssue = getPhoneIssue(artist.addressPhone, country);
    if (phoneIssue) issues.push(phoneIssue);
  }

  return issues;
}

export function hasCompleteArtistShippingProfile(
  artist: ArtistShippingProfile,
): boolean {
  return getArtistShippingProfileIssues(artist).length === 0;
}

export function assertArtistShippableOrigin(
  artist: ArtistShippingProfile,
  context = "Artist shipping address",
): void {
  const issues = getArtistShippingProfileIssues(artist);
  if (issues.length > 0) {
    throw new BadRequestException(`${context}: ${issues.join("; ")}`);
  }
}

/** Reject city/state that do not match the postal code (where lookup is supported). */
export async function assertPostalAddressCoherence(
  address: {
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
  },
  context: string,
): Promise<void> {
  const country = (address.country || "").trim().toUpperCase();
  if (!countrySupportsPostalPlaceLookup(country)) return;

  const zip = (address.zipCode || "").trim();
  const city = (address.city || "").trim();
  const state = normalizeStateOrProvinceCode(address.state, country);
  if (!zip || !city) return;

  const place = await lookupPostalPlace(country, zip);
  // Zippopotam coverage is incomplete for many countries (e.g. JP often has empty
  // state abbreviations / neighborhood place names). Don't block a valid-format save.
  if (!place) return;

  if (state && place.stateCode && place.stateCode !== state) {
    throw new BadRequestException(
      `${context}: state/province does not match ZIP ${place.zipCode} (expected ${place.stateCode})`,
    );
  }

  // City names from Zippopotam are reliable mainly for US/CA.
  const strictCityCountries = new Set(["US", "CA"]);
  if (!strictCityCountries.has(country)) return;

  const cityOk = place.cities.some(
    (placeCity) => normalizePlaceName(placeCity) === normalizePlaceName(city),
  );
  if (!cityOk) {
    const examples = place.cities.slice(0, 3).join(", ");
    throw new BadRequestException(
      `${context}: city does not match ZIP ${place.zipCode}. Use: ${examples}`,
    );
  }
}

export function artistProfileToSenderAddress(
  artist: ArtistShippingProfile & { name: string },
): {
  fullName: string;
  phone: string;
  address: string;
  apartment?: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
} {
  return {
    fullName: artist.name.trim(),
    phone: artist.addressPhone!.trim(),
    address: artist.addressLine1!.trim(),
    apartment: artist.addressLine2?.trim() || undefined,
    city: artist.addressCity!.trim(),
    state: artist.addressState?.trim() || undefined,
    zipCode: artist.addressZipCode!.trim(),
    country: (artist.addressCountry || "US").trim().toUpperCase(),
  };
}

export function assertSenderAddress(
  sender: AddressLike,
  context: string,
): void {
  assertArtistShippableOrigin(
    {
      name: sender.fullName,
      addressLine1: sender.address,
      addressCity: sender.city,
      addressState: sender.state,
      addressZipCode: sender.zipCode,
      addressCountry: sender.country,
      addressPhone: sender.phone,
    },
    context,
  );
}

export function assertRecipientAddress(
  recipient: AddressLike | null | undefined,
): void {
  if (!recipient) {
    throw new BadRequestException(
      "Order is missing the buyer's checkout shipping address",
    );
  }

  const issues: string[] = [];
  const country = recipient.country?.trim().toUpperCase() ?? "";
  const phone = recipient.phone?.trim() ?? "";

  if (!recipient.fullName?.trim()) issues.push("full name is required");
  if (!phone) issues.push("phone is required");
  if (!recipient.address?.trim()) issues.push("street address is required");
  if (!recipient.city?.trim()) issues.push("city is required");
  if (!recipient.zipCode?.trim()) issues.push("postal/ZIP code is required");
  if (!country) issues.push("country is required");

  if (country && countryRequiresState(country) && !recipient.state?.trim()) {
    issues.push(`state/province is required for ${country}`);
  }

  if (country && recipient.zipCode?.trim()) {
    const postalIssue = getPostalCodeIssue(recipient.zipCode, country);
    if (postalIssue) issues.push(postalIssue);
  }

  if (country && phone) {
    const phoneIssue = getPhoneIssue(phone, country);
    if (phoneIssue) {
      issues.push(
        `checkout phone "${phone}" is not valid for destination country ${country}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new BadRequestException(
      `Buyer's checkout address on this order is incomplete (not your seller profile): ${issues.join("; ")}`,
    );
  }
}

export function formatFedExApiErrors(errorData: unknown): string {
  const errors = (errorData as any)?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((entry: any) => {
        const field = entry?.parameterList
          ?.map((param: any) => param?.value)
          .filter(Boolean)
          .join(".");
        return field
          ? `${entry.code || "FEDEX_ERROR"} (${field}): ${entry.message}`
          : `${entry.code || "FEDEX_ERROR"}: ${entry.message}`;
      })
      .join("; ");
  }

  if (typeof errorData === "string") {
    return errorData;
  }

  return "Unknown FedEx error";
}

export function getPhoneIssue(
  phone: string,
  country: string,
): string | null {
  const countryCode = country.trim().toUpperCase();
  if (!countryCode) return "country is required to validate phone";
  if (!phone.trim()) return "phone is required";

  try {
    if (!isValidPhoneNumber(phone, countryCode as CountryCode)) {
      return "a valid phone number is required for this country";
    }
  } catch {
    return "a valid phone number is required for this country";
  }
  return null;
}

/** Normalize phone for FedEx using libphonenumber national number. */
export function normalizePhoneForFedEx(
  phone: string,
  country?: string | null,
): string {
  const normalizedCountry = (country || "").trim().toUpperCase();
  if (!normalizedCountry) {
    throw new BadRequestException("country is required to validate phone");
  }
  const issue = getPhoneIssue(phone, normalizedCountry);
  if (issue) {
    throw new BadRequestException(issue);
  }

  const parsed = parsePhoneNumberFromString(
    phone,
    normalizedCountry as CountryCode,
  );
  if (!parsed) {
    throw new BadRequestException(
      "a valid phone number is required for this country",
    );
  }
  return parsed.nationalNumber;
}

export function getPostalCodeIssue(
  postalCode: string,
  country: string,
): string | null {
  const value = postalCode.trim();
  const countryCode = country.trim().toUpperCase();
  if (!countryCode) return "country is required to validate postal code";
  if (!value) return "postal/ZIP code is required";

  try {
    const result = postalCodes.validate(countryCode, value);
    if (result === true) return null;
    return typeof result === "string"
      ? result
      : "postal/ZIP code format is invalid for this country";
  } catch {
    if (value.length < 3 || value.length > 12) {
      return "postal/ZIP code length is invalid";
    }
    return null;
  }
}

export function assertStateRequiredForCountry(
  state: string | null | undefined,
  country: string,
  context: string,
): string {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedState = normalizeStateOrProvinceCode(
    state,
    normalizedCountry,
  );

  if (countryRequiresState(normalizedCountry) && !normalizedState) {
    throw new BadRequestException(
      `${context}: state/province is required for ${normalizedCountry} shipments`,
    );
  }

  return normalizedState;
}

/**
 * Prefer the state that matches the postal code (FedEx rejects mismatches).
 * Uses free Zippopotam lookup for US/CA; falls back to normalized input.
 */
export async function reconcileStateWithPostalCode(
  state: string | null | undefined,
  postalCode: string,
  country: string,
): Promise<string> {
  const countryCode = country.trim().toUpperCase();
  const normalizedState = normalizeStateOrProvinceCode(state, countryCode);
  if (!countrySupportsPostalPlaceLookup(countryCode)) {
    return normalizedState;
  }

  const zipState = await lookupStateFromPostalCode(countryCode, postalCode);
  if (zipState) {
    return zipState;
  }
  return normalizedState;
}

async function lookupStateFromPostalCode(
  countryCode: string,
  postalCode: string,
): Promise<string | null> {
  const place = await lookupPostalPlace(countryCode, postalCode);
  return place?.stateCode ?? null;
}

type PostalPlace = {
  stateCode: string;
  cities: string[];
  zipCode: string;
};

async function lookupPostalPlace(
  countryCode: string,
  postalCode: string,
): Promise<PostalPlace | null> {
  const country = countryCode.toUpperCase();
  if (!country) return null;

  const compact = postalCode.trim().replace(/\s+/g, "");
  // Zippopotam path conventions vary by country; try a few candidates.
  const candidates = [
    compact.slice(0, 5),
    compact.slice(0, 3),
    compact,
    postalCode.trim(),
  ].filter((value, index, all) => value.length >= 2 && all.indexOf(value) === index);

  for (const pathPostal of candidates) {
    try {
      const response = await fetch(
        `https://api.zippopotam.us/${country.toLowerCase()}/${encodeURIComponent(pathPostal)}`,
      );
      if (!response.ok) continue;
      const data = (await response.json()) as {
        "post code"?: string;
        places?: Array<{
          "place name"?: string;
          state?: string;
          "state abbreviation"?: string;
        }>;
      };
      const places = data.places || [];
      if (places.length === 0) continue;

      const abbr = places[0]["state abbreviation"]?.trim() || "";
      const stateName = places[0].state?.trim() || "";
      const stateCode =
        normalizeStateOrProvinceCode(abbr || stateName, country) ||
        abbr.toUpperCase();

      // Keep the place even when state can't be resolved — callers decide how strict to be.
      return {
        stateCode,
        zipCode: data["post code"] || pathPostal,
        cities: places
          .map((p) => p["place name"]?.trim())
          .filter((name): name is string => Boolean(name)),
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

function normalizePlaceName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Prefer ZIP-derived state/city when postal lookup is supported for the country,
 * so FedEx labels stay coherent even if order metadata has a mismatched city.
 */
export async function reconcilePostalAddress(params: {
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
}): Promise<{ city: string; state: string }> {
  const countryCode = params.country.trim().toUpperCase();
  const normalizedState = normalizeStateOrProvinceCode(
    params.state,
    countryCode,
  );

  if (!countrySupportsPostalPlaceLookup(countryCode)) {
    return { city: params.city.trim(), state: normalizedState };
  }

  const place = await lookupPostalPlace(countryCode, params.postalCode);
  if (!place) {
    return { city: params.city.trim(), state: normalizedState };
  }

  const typedCity = normalizePlaceName(params.city);
  const cityMatches = place.cities.some(
    (city) => normalizePlaceName(city) === typedCity,
  );

  return {
    city: cityMatches ? params.city.trim() : place.cities[0],
    state: place.stateCode,
  };
}

/** Map full subdivision names (e.g. "California") to ISO codes ("CA"). */
export function normalizeStateOrProvinceCode(
  state: string | null | undefined,
  country: string,
): string {
  const raw = state?.trim() ?? "";
  if (!raw) return "";

  const normalizedCountry = country.trim().toUpperCase();
  if (raw.length <= 3) {
    return raw.toUpperCase();
  }

  // Numeric JP codes without padding: "5" handled above; "05" is <= 3.
  if (/^\d+$/.test(raw)) {
    const states = State.getStatesOfCountry(normalizedCountry);
    const byNumber = states.find(
      (entry) => /^\d+$/.test(entry.isoCode) && Number(entry.isoCode) === Number(raw),
    );
    if (byNumber) return byNumber.isoCode.toUpperCase();
  }

  const states = State.getStatesOfCountry(normalizedCountry);
  const exact = states.find(
    (entry) =>
      entry.name.toLowerCase() === raw.toLowerCase() ||
      entry.isoCode.toUpperCase() === raw.toUpperCase(),
  );
  if (exact) return exact.isoCode.toUpperCase();

  const looseKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(prefecture|province|state|region|department)\b/g, "")
      .replace(/ou/g, "o")
      .replace(/uu/g, "u")
      .replace(/oo/g, "o")
      .replace(/fu$/g, "")
      .replace(/\s+/g, "");

  const loose = looseKey(raw);
  const fuzzy = states.find((entry) => {
    const key = looseKey(entry.name);
    return key === loose || key.includes(loose) || loose.includes(key);
  });
  if (fuzzy) return fuzzy.isoCode.toUpperCase();

  return raw;
}

export function buildFedExAddress(params: {
  streetLines: string[];
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  context: string;
}): {
  streetLines: string[];
  city: string;
  stateOrProvinceCode?: string;
  postalCode: string;
  countryCode: string;
} {
  const countryCode = params.country.trim().toUpperCase();
  const postalIssue = getPostalCodeIssue(params.postalCode, countryCode);
  if (postalIssue) {
    throw new BadRequestException(`${params.context}: ${postalIssue}`);
  }

  const stateOrProvinceCode = assertStateRequiredForCountry(
    params.state,
    countryCode,
    params.context,
  );

  const address: {
    streetLines: string[];
    city: string;
    stateOrProvinceCode?: string;
    postalCode: string;
    countryCode: string;
  } = {
    streetLines: params.streetLines.filter((line) => line?.trim()),
    city: params.city.trim(),
    postalCode: params.postalCode.trim(),
    countryCode,
  };

  if (stateOrProvinceCode) {
    address.stateOrProvinceCode = stateOrProvinceCode;
  }

  return address;
}
