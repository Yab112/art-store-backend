import { ShipmentStatus } from "@prisma/client";
import {
  mapFedExCodeToStatus,
  mapScanEventStatus,
  resolveShipmentStatus,
  isTimestampInShipmentLifecycle,
  computeShipmentStatusFromTrack,
} from "./fedex-tracking.mapper";

describe("fedex-tracking.mapper", () => {
  describe("mapFedExCodeToStatus", () => {
    it("maps IT / OD / DL", () => {
      expect(mapFedExCodeToStatus("IT")).toBe("IN_TRANSIT");
      expect(mapFedExCodeToStatus("OD")).toBe("OUT_FOR_DELIVERY");
      expect(mapFedExCodeToStatus("DL")).toBe("DELIVERED");
    });

    it("maps PU to PICKED_UP and OC to LABEL_CREATED", () => {
      expect(mapFedExCodeToStatus("PU")).toBe("PICKED_UP");
      expect(mapFedExCodeToStatus("OC")).toBe("LABEL_CREATED");
    });

    it("returns null for unknown codes", () => {
      expect(mapFedExCodeToStatus("ZZ")).toBeNull();
      expect(mapFedExCodeToStatus("")).toBeNull();
      expect(mapFedExCodeToStatus(null)).toBeNull();
    });
  });

  describe("resolveShipmentStatus", () => {
    it("advances LABEL_CREATED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED", () => {
      expect(resolveShipmentStatus("LABEL_CREATED", "IT")).toBe("IN_TRANSIT");
      expect(resolveShipmentStatus("IN_TRANSIT", "OD")).toBe(
        "OUT_FOR_DELIVERY",
      );
      expect(resolveShipmentStatus("OUT_FOR_DELIVERY", "DL")).toBe("DELIVERED");
    });

    it("does not downgrade from DELIVERED", () => {
      expect(resolveShipmentStatus("DELIVERED", "IT")).toBe("DELIVERED");
      expect(resolveShipmentStatus("DELIVERED", "OD")).toBe("DELIVERED");
    });

    it("does not downgrade OUT_FOR_DELIVERY to IN_TRANSIT", () => {
      expect(resolveShipmentStatus("OUT_FOR_DELIVERY", "IT")).toBe(
        "OUT_FOR_DELIVERY",
      );
    });

    it("applies EXCEPTION and CANCELLED from FedEx", () => {
      expect(resolveShipmentStatus("IN_TRANSIT", "DE")).toBe("EXCEPTION");
      expect(resolveShipmentStatus("IN_TRANSIT", "CA")).toBe("CANCELLED");
    });

    it("allows recovery from EXCEPTION to a forward status", () => {
      expect(resolveShipmentStatus("EXCEPTION", "IT")).toBe("IN_TRANSIT");
      expect(resolveShipmentStatus("EXCEPTION", "DL")).toBe("DELIVERED");
    });

    it("keeps current status when FedEx code is unknown", () => {
      expect(resolveShipmentStatus("IN_TRANSIT", "ZZ")).toBe("IN_TRANSIT");
      expect(resolveShipmentStatus("LABEL_CREATED", null)).toBe(
        "LABEL_CREATED",
      );
    });
  });

  describe("mapScanEventStatus", () => {
    it("uses mapped code when known", () => {
      expect(mapScanEventStatus("DL", "IN_TRANSIT")).toBe("DELIVERED");
    });

    it("falls back when code unknown", () => {
      const fallback: ShipmentStatus = "OUT_FOR_DELIVERY";
      expect(mapScanEventStatus("ZZ", fallback)).toBe(fallback);
    });
  });

  describe("lifecycle helpers + computeShipmentStatusFromTrack", () => {
    const createdAt = new Date("2026-07-15T10:00:00.000Z");

    it("treats scans before lifecycle window as out of scope", () => {
      expect(
        isTimestampInShipmentLifecycle(
          new Date("2025-05-15T12:00:00.000Z"),
          createdAt,
        ),
      ).toBe(false);
      expect(
        isTimestampInShipmentLifecycle(
          new Date("2026-07-15T09:30:00.000Z"),
          createdAt,
        ),
      ).toBe(true); // within 1h skew
    });

    it("recomputes LABEL_CREATED when only recycled IT codes exist", () => {
      expect(
        computeShipmentStatusFromTrack({
          currentStatus: "IN_TRANSIT",
          latestStatusCode: "OC",
          latestStatusAt: createdAt,
          shipmentCreatedAt: createdAt,
          inLifecycleScanCodes: ["OC"],
        }),
      ).toBe("LABEL_CREATED");
    });

    it("ignores recycled latestStatusDetail DL with no in-lifecycle date", () => {
      expect(
        computeShipmentStatusFromTrack({
          currentStatus: "LABEL_CREATED",
          latestStatusCode: "DL",
          latestStatusAt: null,
          shipmentCreatedAt: createdAt,
          inLifecycleScanCodes: [],
        }),
      ).toBe("LABEL_CREATED");
    });

    it("ignores recycled latestStatusDetail DL dated before lifecycle", () => {
      expect(
        computeShipmentStatusFromTrack({
          currentStatus: "DELIVERED",
          latestStatusCode: "DL",
          latestStatusAt: new Date("2025-05-01T12:00:00.000Z"),
          shipmentCreatedAt: createdAt,
          inLifecycleScanCodes: ["OC"],
        }),
      ).toBe("LABEL_CREATED");
    });

    it("advances to DELIVERED when DL scan is inside lifecycle", () => {
      expect(
        computeShipmentStatusFromTrack({
          currentStatus: "LABEL_CREATED",
          latestStatusCode: "DL",
          latestStatusAt: new Date("2026-07-15T18:00:00.000Z"),
          shipmentCreatedAt: createdAt,
          inLifecycleScanCodes: ["OC", "IT", "DL"],
        }),
      ).toBe("DELIVERED");
    });

    it("advances when in-lifecycle IT is present", () => {
      expect(
        computeShipmentStatusFromTrack({
          currentStatus: "LABEL_CREATED",
          latestStatusCode: "OC",
          latestStatusAt: createdAt,
          shipmentCreatedAt: createdAt,
          inLifecycleScanCodes: ["OC", "IT"],
        }),
      ).toBe("IN_TRANSIT");
    });
  });
});
