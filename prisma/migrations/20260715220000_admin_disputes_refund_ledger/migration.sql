-- Dispute order link + resolve audit fields
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "gatewayRefundId" TEXT;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "reservedAmount" DECIMAL(10,2);
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "reservedProvider" TEXT;

CREATE INDEX IF NOT EXISTS "Dispute_orderId_idx" ON "Dispute"("orderId");
CREATE INDEX IF NOT EXISTS "Dispute_status_idx" ON "Dispute"("status");
CREATE INDEX IF NOT EXISTS "Dispute_targetUserId_idx" ON "Dispute"("targetUserId");

DO $$ BEGIN
  ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Refund statuses + fields
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';

ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "disputeId" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "gatewayRefundId" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "provider" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "refunds_disputeId_key" ON "refunds"("disputeId");
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_idempotencyKey_key" ON "refunds"("idempotencyKey");

DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seller ledger
DO $$ BEGIN
  CREATE TYPE "SellerLedgerEntryType" AS ENUM (
    'ORDER_CREDIT_PENDING',
    'PENDING_RELEASE',
    'PENDING_CANCELLED',
    'DISPUTE_REFUND_DEBIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "seller_ledger_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "disputeId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "provider" TEXT NOT NULL,
  "type" "SellerLedgerEntryType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seller_ledger_entries_userId_idx" ON "seller_ledger_entries"("userId");
CREATE INDEX IF NOT EXISTS "seller_ledger_entries_orderId_idx" ON "seller_ledger_entries"("orderId");
CREATE INDEX IF NOT EXISTS "seller_ledger_entries_disputeId_idx" ON "seller_ledger_entries"("disputeId");
CREATE INDEX IF NOT EXISTS "seller_ledger_entries_type_idx" ON "seller_ledger_entries"("type");

DO $$ BEGIN
  ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Platform earning adjustments
CREATE TABLE IF NOT EXISTS "platform_earning_adjustments" (
  "id" TEXT NOT NULL,
  "platformEarningId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "disputeId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_earning_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_earning_adjustments_orderId_idx" ON "platform_earning_adjustments"("orderId");
CREATE INDEX IF NOT EXISTS "platform_earning_adjustments_platformEarningId_idx" ON "platform_earning_adjustments"("platformEarningId");
CREATE INDEX IF NOT EXISTS "platform_earning_adjustments_disputeId_idx" ON "platform_earning_adjustments"("disputeId");

DO $$ BEGIN
  ALTER TABLE "platform_earning_adjustments" ADD CONSTRAINT "platform_earning_adjustments_platformEarningId_fkey"
    FOREIGN KEY ("platformEarningId") REFERENCES "platform_earnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dispute resolution audit events
CREATE TABLE IF NOT EXISTS "dispute_resolution_events" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "outcome" TEXT,
  "resolutionNote" TEXT,
  "gatewayRefundId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_resolution_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dispute_resolution_events_disputeId_idx" ON "dispute_resolution_events"("disputeId");

DO $$ BEGIN
  ALTER TABLE "dispute_resolution_events" ADD CONSTRAINT "dispute_resolution_events_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
