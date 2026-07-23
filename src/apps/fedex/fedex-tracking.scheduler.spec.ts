import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FedExTrackingScheduler } from "./fedex-tracking.scheduler";
import { FedExService } from "./fedex.service";
import { PrismaService } from "../../core/database/prisma.service";

const SHIPMENT_CREATED_AT = new Date("2026-07-15T10:00:00.000Z");

describe("FedExTrackingScheduler.applyTrackResult", () => {
  let scheduler: FedExTrackingScheduler;
  let prisma: {
    shipmentEvent: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    shipment: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      shipmentEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      shipment: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FedExTrackingScheduler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: FedExService,
          useValue: {
            getTrackOAuthToken: jest.fn(),
            apiUrl: "https://apis-sandbox.fedex.com",
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("https://apis-sandbox.fedex.com"),
          },
        },
      ],
    }).compile();

    scheduler = module.get(FedExTrackingScheduler);
  });

  it("maps DL fixture to DELIVERED and inserts scan events", async () => {
    await scheduler.applyTrackResult(
      "ship-1",
      "IN_TRANSIT",
      {
        latestStatusDetail: { code: "DL", description: "Delivered" },
        scanEvents: [
          {
            date: "2026-07-15T12:00:00.000Z",
            eventDescription: "Delivered",
            derivedStatusCode: "DL",
            scanLocation: {
              city: "Sedona",
              stateOrProvinceCode: "AZ",
              countryCode: "US",
            },
          },
        ],
      },
      SHIPMENT_CREATED_AT,
    );

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ship-1" },
        data: expect.objectContaining({
          status: "DELIVERED",
          lastTrackingSyncError: null,
        }),
      }),
    );
    expect(prisma.shipmentEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          shipmentId: "ship-1",
          status: "DELIVERED",
          description: "Delivered",
          location: "Sedona, AZ, US",
        }),
      ],
    });
  });

  it("rolls back false DELIVERED when Track has no in-lifecycle evidence", async () => {
    await scheduler.applyTrackResult(
      "ship-1",
      "DELIVERED",
      {
        latestStatusDetail: { code: "DL" },
        scanEvents: [
          {
            date: "2025-05-15T12:00:00.000Z",
            eventDescription: "Delivered",
            derivedStatusCode: "DL",
          },
        ],
      },
      SHIPMENT_CREATED_AT,
    );

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "LABEL_CREATED" }),
      }),
    );
  });

  it("does not advance on recycled DL latestStatusDetail with empty lifecycle scans", async () => {
    await scheduler.applyTrackResult(
      "ship-1",
      "LABEL_CREATED",
      {
        latestStatusDetail: { code: "DL" },
        scanEvents: [],
      },
      SHIPMENT_CREATED_AT,
    );

    const updateData = prisma.shipment.update.mock.calls[0][0].data;
    expect(updateData.status).toBeUndefined();
    expect(updateData.lastTrackingSyncError).toBeNull();
  });

  it("skips duplicate scan events on re-sync", async () => {
    prisma.shipmentEvent.findMany.mockResolvedValue([
      {
        timestamp: new Date("2026-07-15T12:00:00.000Z"),
        description: "Delivered",
      },
    ]);

    await scheduler.applyTrackResult(
      "ship-1",
      "OUT_FOR_DELIVERY",
      {
        latestStatusDetail: { code: "DL" },
        scanEvents: [
          {
            date: "2026-07-15T12:00:00.000Z",
            eventDescription: "Delivered",
            derivedStatusCode: "DL",
          },
        ],
      },
      SHIPMENT_CREATED_AT,
    );

    expect(prisma.shipmentEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("advances from in-lifecycle scan codes when latestStatusDetail lags", async () => {
    await scheduler.applyTrackResult(
      "ship-1",
      "LABEL_CREATED",
      {
        latestStatusDetail: { code: "OC" },
        scanEvents: [
          {
            date: "2026-07-15T12:00:00.000Z",
            eventDescription: "In transit",
            derivedStatusCode: "IT",
            scanLocation: {
              city: "GREENWOOD",
              stateOrProvinceCode: "IN",
              countryCode: "US",
            },
          },
        ],
      },
      SHIPMENT_CREATED_AT,
    );

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_TRANSIT" }),
      }),
    );
  });

  it("ignores recycled pre-label scans for status and event insert", async () => {
    await scheduler.applyTrackResult(
      "ship-1",
      "IN_TRANSIT",
      {
        latestStatusDetail: { code: "OC" },
        scanEvents: [
          {
            date: "2025-05-15T12:00:00.000Z",
            eventDescription: "In transit",
            derivedStatusCode: "IT",
            scanLocation: {
              city: "GREENWOOD",
              stateOrProvinceCode: "IN",
              countryCode: "US",
            },
          },
          {
            date: "2026-07-15T11:00:00.000Z",
            eventDescription: "Shipping label created",
            derivedStatusCode: "OC",
          },
        ],
      },
      SHIPMENT_CREATED_AT,
    );

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "LABEL_CREATED" }),
      }),
    );
    expect(prisma.shipmentEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          description: "Shipping label created",
          status: "LABEL_CREATED",
        }),
      ],
    });
    expect(prisma.shipmentEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        shipmentId: "ship-1",
        timestamp: { lt: expect.any(Date) },
      },
    });
  });
});
