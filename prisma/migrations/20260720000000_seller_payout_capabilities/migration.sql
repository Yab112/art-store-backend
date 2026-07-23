-- Capability-based payout architecture (PAYMENT_AND_PAYOUT_ARCHITECTURE.md)

-- Listing currency: canonical price currency (marketplace never converts)
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "listingCurrency" TEXT NOT NULL DEFAULT 'USD';

-- Durable seller payout capabilities
CREATE TABLE IF NOT EXISTS "seller_payout_capabilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payoutSupport" TEXT NOT NULL DEFAULT 'full',
    "paypalEmail" TEXT,
    "chapaAccountName" TEXT,
    "chapaAccountNumber" TEXT,
    "chapaBankCode" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seller_payout_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seller_payout_capabilities_userId_provider_key"
  ON "seller_payout_capabilities"("userId", "provider");

CREATE INDEX IF NOT EXISTS "seller_payout_capabilities_userId_idx"
  ON "seller_payout_capabilities"("userId");

ALTER TABLE "seller_payout_capabilities"
  DROP CONSTRAINT IF EXISTS "seller_payout_capabilities_userId_fkey";

ALTER TABLE "seller_payout_capabilities"
  ADD CONSTRAINT "seller_payout_capabilities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from legacy payment_method_preferences
INSERT INTO "seller_payout_capabilities" (
  "id", "userId", "provider", "payoutSupport",
  "paypalEmail", "chapaAccountName", "chapaAccountNumber", "chapaBankCode",
  "connectedAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."userId",
  'paypal',
  'full',
  p."paypalEmail",
  NULL,
  NULL,
  NULL,
  COALESCE(p."updatedAt", NOW()),
  NOW()
FROM "payment_method_preferences" p
WHERE p."paypalEmail" IS NOT NULL AND TRIM(p."paypalEmail") <> ''
ON CONFLICT ("userId", "provider") DO NOTHING;

INSERT INTO "seller_payout_capabilities" (
  "id", "userId", "provider", "payoutSupport",
  "paypalEmail", "chapaAccountName", "chapaAccountNumber", "chapaBankCode",
  "connectedAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."userId",
  'chapa',
  'full',
  NULL,
  p."chapaAccountName",
  p."chapaAccountNumber",
  p."chapaBankCode",
  COALESCE(p."updatedAt", NOW()),
  NOW()
FROM "payment_method_preferences" p
WHERE p."chapaAccountNumber" IS NOT NULL AND TRIM(p."chapaAccountNumber") <> ''
ON CONFLICT ("userId", "provider") DO NOTHING;

-- If preference method is set but account fields empty, still create capability shell for that method
INSERT INTO "seller_payout_capabilities" (
  "id", "userId", "provider", "payoutSupport",
  "paypalEmail", "chapaAccountName", "chapaAccountNumber", "chapaBankCode",
  "connectedAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."userId",
  LOWER(p."method"),
  'full',
  p."paypalEmail",
  p."chapaAccountName",
  p."chapaAccountNumber",
  p."chapaBankCode",
  COALESCE(p."updatedAt", NOW()),
  NOW()
FROM "payment_method_preferences" p
WHERE LOWER(p."method") IN ('paypal', 'chapa')
ON CONFLICT ("userId", "provider") DO NOTHING;
