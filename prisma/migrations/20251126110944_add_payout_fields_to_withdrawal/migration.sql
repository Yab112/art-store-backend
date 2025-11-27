-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "payoutBatchId" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Withdrawal_payoutBatchId_idx" ON "Withdrawal"("payoutBatchId");

