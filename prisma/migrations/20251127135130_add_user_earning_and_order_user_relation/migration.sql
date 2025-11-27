-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "earning" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalEarning" TEXT NOT NULL DEFAULT '0';

-- CreateTable
CREATE TABLE "platform_earnings" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "orderData" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_earnings_orderId_key" ON "platform_earnings"("orderId");

-- CreateIndex
CREATE INDEX "platform_earnings_orderId_idx" ON "platform_earnings"("orderId");

-- CreateIndex
CREATE INDEX "platform_earnings_transactionId_idx" ON "platform_earnings"("transactionId");

-- CreateIndex
CREATE INDEX "platform_earnings_createdAt_idx" ON "platform_earnings"("createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_buyerEmail_idx" ON "Order"("buyerEmail");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_earnings" ADD CONSTRAINT "platform_earnings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_earnings" ADD CONSTRAINT "platform_earnings_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
