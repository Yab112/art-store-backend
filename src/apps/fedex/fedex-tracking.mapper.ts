import { ShipmentStatus } from "@prisma/client";

/**
 * Maps FedEx Track event / latest-status codes to internal ShipmentStatus.
 * Reference: FedEx Developer Portal — Basic Integrated Visibility.
 */
export const FEDEX_STATUS_MAP: Record<string, ShipmentStatus> = {
  OC: "LABEL_CREATED",
  PU: "PICKED_UP",
  AF: "IN_TRANSIT",
  AR: "IN_TRANSIT",
  DP: "IN_TRANSIT",
  IT: "IN_TRANSIT",
  OD: "OUT_FOR_DELIVERY",
  DL: "DELIVERED",
  DE: "EXCEPTION",
  CA: "CANCELLED",
  RS: "EXCEPTION",
};

/**
 * Allow scans slightly before shipment.createdAt (clock skew / label vs Track latency).
 * Older recycled sandbox history falls outside this window.
 */
export const SHIPMENT_SCAN_SKEW_MS = 60 * 60 * 1000; // 1 hour

/** Forward progress rank. EXCEPTION/CANCELLED are special-cased. */
const STATUS_RANK: Record<ShipmentStatus, number> = {
  PENDING_ADDRESS: 0,
  LABEL_CREATED: 1,
  PICKED_UP: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  EXCEPTION: -1,
  CANCELLED: -1,
};

export function mapFedExCodeToStatus(
  code?: string | null,
): ShipmentStatus | null {
  const key = (code || "").trim().toUpperCase();
  if (!key) return null;
  return FEDEX_STATUS_MAP[key] ?? null;
}

/**
 * Apply FedEx latest status onto current shipment status.
 * - Unknown FedEx codes do not change shipment status.
 * - Never leave DELIVERED / CANCELLED for a lower progress status.
 * - EXCEPTION / CANCELLED from FedEx always apply.
 * - Otherwise only allow equal or forward progress (EXCEPTION can recover forward).
 */
export function resolveShipmentStatus(
  current: ShipmentStatus,
  fedexCode?: string | null,
): ShipmentStatus {
  const mapped = mapFedExCodeToStatus(fedexCode);
  if (!mapped) return current;

  if (mapped === "EXCEPTION" || mapped === "CANCELLED") {
    return mapped;
  }

  if (current === "DELIVERED" || current === "CANCELLED") {
    return current;
  }

  if (current === "EXCEPTION" || current === "PENDING_ADDRESS") {
    return mapped;
  }

  if (STATUS_RANK[mapped] >= STATUS_RANK[current]) {
    return mapped;
  }

  return current;
}

export function mapScanEventStatus(
  fedexCode: string | null | undefined,
  fallback: ShipmentStatus,
): ShipmentStatus {
  return mapFedExCodeToStatus(fedexCode) ?? fallback;
}

export function shipmentLifecycleStart(
  shipmentCreatedAt: Date,
  skewMs: number = SHIPMENT_SCAN_SKEW_MS,
): Date {
  return new Date(shipmentCreatedAt.getTime() - skewMs);
}

export function isTimestampInShipmentLifecycle(
  timestamp: Date,
  shipmentCreatedAt: Date,
  skewMs: number = SHIPMENT_SCAN_SKEW_MS,
): boolean {
  return timestamp.getTime() >= shipmentLifecycleStart(shipmentCreatedAt, skewMs).getTime();
}

export function getFedExScanTimestamp(scan: {
  date?: string;
  dateTime?: string;
}): Date {
  return new Date(scan.date || scan.dateTime || 0);
}

/**
 * Recompute shipment status from FedEx Track for this label's lifecycle.
 * - Starts from LABEL_CREATED (or keeps PENDING_ADDRESS / CANCELLED).
 * - Applies latestStatusDetail only when its timestamp is inside the lifecycle window
 *   (sandbox recycled TNs often report DL/IT with old history — ignore those).
 * - Then applies only in-lifecycle scan codes (forward-only within this recompute).
 * - Absolute recompute: a false DELIVERED/IN_TRANSIT from recycled Track can roll back.
 */
export function computeShipmentStatusFromTrack(params: {
  currentStatus: ShipmentStatus;
  latestStatusCode?: string | null;
  /** When set with shipmentCreatedAt, gates whether latestStatusCode is trusted. */
  latestStatusAt?: Date | null;
  shipmentCreatedAt?: Date;
  inLifecycleScanCodes: Array<string | null | undefined>;
}): ShipmentStatus {
  const {
    currentStatus,
    latestStatusCode,
    latestStatusAt,
    shipmentCreatedAt,
    inLifecycleScanCodes,
  } = params;

  if (currentStatus === "CANCELLED" || currentStatus === "PENDING_ADDRESS") {
    return currentStatus;
  }

  // Recompute from this label's lifecycle so recycled pre-label status cannot stick.
  let status: ShipmentStatus =
    currentStatus === "EXCEPTION" ? "EXCEPTION" : "LABEL_CREATED";

  const trustLatest =
    !!latestStatusCode &&
    !!shipmentCreatedAt &&
    !!latestStatusAt &&
    !Number.isNaN(latestStatusAt.getTime()) &&
    isTimestampInShipmentLifecycle(latestStatusAt, shipmentCreatedAt);

  if (trustLatest) {
    status = resolveShipmentStatus(status, latestStatusCode);
  }

  for (const code of inLifecycleScanCodes) {
    status = resolveShipmentStatus(status, code);
  }
  return status;
}

/** Hide recycled pre-label track history when returning shipments to clients. */
export function filterShipmentEventsToLifecycle<
  T extends { timestamp: Date },
>(events: T[], shipmentCreatedAt: Date): T[] {
  return events.filter((event) =>
    isTimestampInShipmentLifecycle(event.timestamp, shipmentCreatedAt),
  );
}

export function withLifecycleFilteredEvents<
  T extends { createdAt: Date; events: Array<{ timestamp: Date }> },
>(shipment: T): T {
  return {
    ...shipment,
    events: filterShipmentEventsToLifecycle(shipment.events, shipment.createdAt),
  };
}
