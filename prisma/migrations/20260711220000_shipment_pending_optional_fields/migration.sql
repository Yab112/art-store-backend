-- Allow PENDING_ADDRESS / EXCEPTION rows without FedEx label data yet.
DO $$ BEGIN
  ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_ADDRESS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "shipments"
  ALTER COLUMN "trackingNumber" DROP NOT NULL,
  ALTER COLUMN "masterTrackingId" DROP NOT NULL,
  ALTER COLUMN "labelUrl" DROP NOT NULL;

ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "shipments_orderId_artistId_key"
  ON "shipments"("orderId", "artistId");
