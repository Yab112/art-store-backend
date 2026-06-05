-- AlterTable (safe: nullable column, no data loss; idempotent if re-run)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
