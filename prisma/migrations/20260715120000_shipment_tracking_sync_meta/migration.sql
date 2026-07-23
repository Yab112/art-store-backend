-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "lastTrackingSyncAt" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN "lastTrackingSyncError" TEXT;
