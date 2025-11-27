-- AlterEnum
-- This migration adds REJECTED to the PaymentStatus enum
DO $$ BEGIN
    -- Check if REJECTED already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'REJECTED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')
    ) THEN
        -- Add REJECTED to the PaymentStatus enum
        ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';
    END IF;
END $$;

