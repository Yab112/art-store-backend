-- Add payoutBatchId and metadata fields to Withdrawal table
-- This migration adds fields needed for PayPal webhook tracking

-- Add payoutBatchId column
ALTER TABLE "Withdrawal" 
ADD COLUMN IF NOT EXISTS "payoutBatchId" TEXT;

-- Add metadata JSON column
ALTER TABLE "Withdrawal" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Add index on payoutBatchId for faster webhook lookups
CREATE INDEX IF NOT EXISTS "Withdrawal_payoutBatchId_idx" ON "Withdrawal"("payoutBatchId");

