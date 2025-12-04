# Authentication Fix - Better Auth Session Issue

## Problem

`auth.api.getSession()` returns `null` even though:
- ✅ Session tokens exist in cookies
- ✅ Sessions exist in database
- ✅ Cookies reach the backend

## Root Cause

**Database schema mismatch with Better Auth v1.3.8 expectations:**

### What You Have (WRONG):
```sql
Session table:
- id: "e62cd556-6087-4506-bef8-f1452963ef8e"  ← UUID
- token: "DLvm6laXc1neNo0O42AiiE7WdSmRWOgV"   ← Session token (separate field)
- userId: "..."
```

### What Better Auth Expects (CORRECT):
```sql
Session table:
- id: "DLvm6laXc1neNo0O42AiiE7WdSmRWOgV"  ← Session token IS the ID
- userId: "..."
```

## Why This Happens

Better Auth creates signed cookies like:
```
better-auth.session_token = "{token}.{signature}"
Example: "DLvm6laXc1neNo0O42AiiE7WdSmRWOgV.kbI9b8LgXWDMP6lB/JhYFXj4xxt5i9B5f6ZVyR+ButQI="
```

Then it looks up the session:
```sql
SELECT * FROM "Session" WHERE id = 'DLvm6laXc1neNo0O42AiiE7WdSmRWOgV'
```

But your database has:
```sql
id = 'e62cd556...' (UUID)
token = 'DLvm6laXc1neNo0O42AiiE7WdSmRWOgV'
```

Result: **Session not found** → `null`

## The Fix

### Step 1: Update Prisma Schema

Already done! Your schema now has:
```prisma
model Session {
  id        String   @id // Session token IS the ID
  userId    String
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Step 2: Create Migration

```bash
npx prisma migrate dev --name fix_session_token_schema
```

This will:
1. Delete all existing sessions (they're incompatible anyway)
2. Drop the `token` column
3. Better Auth will now use session token as `id`

### Step 3: Update Better Auth Config

Already done! Your `src/auth.ts` now has:
```typescript
advanced: {
  database: {
    generateId: true,  // Let Better Auth generate session IDs
  },
}
```

### Step 4: Clear Everything and Test

```bash
# 1. Apply migration
npx prisma migrate deploy

# 2. Regenerate Prisma client
npx prisma generate

# 3. Restart your server
# Kill current server, then:
pnpm run start:dev
```

Then in your browser:
1. **Clear all cookies** for localhost:3000
2. **Sign in again**
3. **Test protected routes**

## Expected Result

After fix:
```sql
-- New session in database will look like:
id:        "DLvm6laXc1neNo0O42AiiE7WdSmRWOgV"  ← Session token
userId:    "user-uuid-here"
expiresAt: "2025-11-24T00:00:00Z"
```

And Better Auth will find it!

## Why All Users Need to Re-login

- Old sessions have wrong structure (UUID id + separate token)
- New sessions use token as ID
- They're incompatible - migration deletes all old sessions
- This is expected and necessary

## Reference

- GitHub Issue: https://github.com/better-auth/better-auth/issues/3892
- Better Auth Docs: https://www.better-auth.com/docs/concepts/session-management
