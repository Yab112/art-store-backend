# Better Auth Session Fix Guide

## Problem Summary

Better Auth sessions were not working because your Prisma schema had an incorrect `Session` model structure.

### The Issue

**WRONG Schema (Before):**
```prisma
model Session {
  id        String   @id @default(uuid())  ← Separate UUID
  token     String   @unique                 ← Session token as separate field
  ...
}
```

**CORRECT Schema (After):**
```prisma
model Session {
  id        String   @id  ← Session token IS the ID (no default UUID)
  ...
}
```

### Why This Matters

Better Auth uses **signed cookies** for session management:

1. **Cookie Format**: `{token}.{signature}`
   - Example: `7aON9QvXi7cN5W22aBoYB7O4cBy827eS.SmI0GbF5gaEv1pq+izKZDD4op+C+PveIS0/N+FqGUWc=`
   - First part (`7aON9QvXi7cN5W22aBoYB7O4cBy827eS`): The session token
   - Second part: HMAC signature (using `BETTER_AUTH_SECRET`)

2. **Database Lookup**: Better Auth uses the first part (session token) to look up `Session` where `id = token`

3. **Your Bug**: Your database had:
   ```
   id: "some-uuid-12345"
   token: "7aON9QvXi7cN5W22aBoYB7O4cBy827eS"
   ```
   Better Auth tried to find session with `id = "7aON9QvXi7cN5W22aBoYB7O4cBy827eS"` but couldn't find it!

## How to Fix

### Step 1: Apply the Migration

The migration is already created at:
`prisma/migrations/20251123_fix_session_token_structure/migration.sql`

**Run it manually** when your database is available:

```bash
npx prisma migrate deploy
```

OR apply directly:

```bash
psql $DATABASE_URL < prisma/migrations/20251123_fix_session_token_structure/migration.sql
```

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 3: Restart Your Server

```bash
# Kill current server
# Then restart
pnpm run start:dev
```

### Step 4: Test Authentication

1. **Clear all existing cookies** in your browser
2. **Sign in again** - This will create a new session with the correct structure
3. **Test protected routes** - Should now work!

## What the Migration Does

1. ✅ Truncates all existing sessions (they won't work with new schema anyway)
2. ✅ Drops the `token` column
3. ✅ Removes `@default(uuid())` from `id` column
4. ✅ Better Auth will now set `id` directly as the session token

## Important Notes

### ⚠️ Breaking Change

- **All users will need to log in again** after this migration
- Existing sessions will be invalidated
- This is expected and necessary

### ✅ Schema is Now Correct

According to Better Auth documentation:

> "The session table stores the session data. The session table has the following fields:
> - `id`: The session token. Which is also used as the session cookie."

Your schema now matches this specification.

### 🔐 Security

Make sure you have `BETTER_AUTH_SECRET` set in your environment:

```bash
# In your .env file
BETTER_AUTH_SECRET=your-secret-key-here
```

If you don't set it, Better Auth uses `"fallback-secret-key"` which is insecure for production.

## Verification

After applying the fix, you can verify it's working by:

1. **Check logs** - Should see `Session: Found` instead of `Session: Not found`
2. **Test API** - Protected endpoints should return user data
3. **Check database** - New sessions should have `id` = session token (no separate token field)

## Future Sessions Will Look Like:

```sql
-- Example session in database after fix:
id:        "7aON9QvXi7cN5W22aBoYB7O4cBy827eS"  ← Session token
userId:    "user-uuid-here"
expiresAt: "2025-11-30T00:00:00Z"
...
```

## Need Help?

If you still have issues after applying this fix:

1. Check that `BETTER_AUTH_SECRET` is set consistently
2. Verify the migration ran successfully
3. Clear browser cookies completely
4. Check server logs for any new error messages

## Reference

- [Better Auth Docs: Session Management](https://www.better-auth.com/docs/concepts/session-management)
- [Better Auth Docs: Database Schema](https://www.better-auth.com/docs/concepts/database)
