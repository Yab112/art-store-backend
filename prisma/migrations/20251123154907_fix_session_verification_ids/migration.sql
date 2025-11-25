/*
  Fix Session and Verification models to work with Better Auth generateId: false
  
  According to Better Auth documentation and GitHub issue #3892:
  - When generateId: false, Better Auth sets id fields manually
  - Session table needs both id and token fields
  - Better Auth uses token field to look up sessions from cookies
  - Removing @default(uuid()) allows Better Auth to control id generation
  
  This fixes:
  1. auth.api.getSession() returning null despite valid sessions
  2. Social login errors (Verification model id missing)
*/

-- Step 1: Drop all existing sessions (they won't work with new schema)
TRUNCATE TABLE "Session" CASCADE;

-- Step 2: Remove default UUID generator from Session.id
-- Better Auth will set this manually when generateId: false
-- PostgreSQL doesn't support DROP DEFAULT IF EXISTS, so we check first
DO $$ 
BEGIN
  -- Check if column has a default and remove it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Session' 
    AND column_name = 'id'
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;

-- Step 3: Ensure token column exists with unique constraint
-- Better Auth uses token field to look up sessions from cookies
DO $$ 
BEGIN
  -- Check if token column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'token'
  ) THEN
    -- Add token column if it doesn't exist
    ALTER TABLE "Session" ADD COLUMN "token" TEXT NOT NULL;
  END IF;
  
  -- Ensure unique constraint exists on token
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'Session' AND indexname = 'Session_token_key'
  ) THEN
    CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
  END IF;
END $$;

-- Step 4: Remove default UUID generator from Verification.id
-- Better Auth will set this manually when generateId: false
DO $$ 
BEGIN
  -- Check if column has a default and remove it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Verification' 
    AND column_name = 'id'
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE "Verification" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;

