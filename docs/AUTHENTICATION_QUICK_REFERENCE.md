# Authentication Quick Reference

## Quick Fixes

### User Can't Log In / Session Returns Null

**Symptom**: Frontend shows user as logged out even after signing in.

**Quick Fix**:

1. Clear browser cookies for `localhost:3000` (or your domain)
2. Sign in again

**Root Cause**: Duplicate `better-auth.session_token` cookies in browser.

**Permanent Fix**: Already implemented in `src/main.ts` - cookie cleaning middleware.

---

## How Authentication Works

### Flow

1. **User Signs In** → Better Auth creates session in database
2. **Cookie Set** → Browser stores `better-auth.session_token={token}.{signature}`
3. **Frontend Checks** → Calls `/api/auth/session` endpoint
4. **Backend Validates** → Better Auth verifies cookie signature and looks up session
5. **Session Returned** → Frontend receives user data

### Key Components

- **Better Auth Handler** (`/api/auth/*`): Handles all auth endpoints
- **Cookie Cleaner Middleware** (`src/main.ts`): Removes duplicate session cookies
- **AuthGuard** (`src/core/guards/auth.guard.ts`): Protects routes, validates sessions

---

## Common Issues

### Issue: "No valid session found"

**Cause**: Stale cookie or duplicate cookies

**Solution**:

- Cookie cleaner middleware should handle this automatically
- If persists, clear browser cookies

### Issue: AuthGuard works but frontend shows logged out

**Cause**: Better Auth's `/api/auth/session` endpoint receiving duplicate cookies

**Solution**: Fixed by cookie cleaning middleware in `src/main.ts`

### Issue: Session exists in DB but Better Auth returns null

**Cause**: Cookie token doesn't match session token in database

**Solution**:

- Check for duplicate cookies (middleware handles this)
- Verify `BETTER_AUTH_SECRET` is consistent
- Check session expiration

---

## Debugging

### Check Session in Database

```bash
cd art-gallery-backend
npx tsx scripts/debug-sessions.ts
```

### Check Cookies in Browser

1. Open DevTools → Application → Cookies
2. Look for `better-auth.session_token`
3. If multiple exist, clear all and sign in again

### Check Backend Logs

Look for:

- `[Cookie Cleaner] Found X duplicate better-auth.session_token cookies`
- `Better Auth getSession result: Found` or `NOT FOUND`
- `Session user ID: ...`

---

## Files to Check

- `src/main.ts` - Cookie cleaning middleware
- `src/core/guards/auth.guard.ts` - Route protection
- `src/auth.ts` - Better Auth configuration
- `prisma/schema.prisma` - Session model schema

---

## Related Documentation

- [Duplicate Cookie Auth Fix](./DUPLICATE_COOKIE_AUTH_FIX.md) - Detailed explanation
- [Better Auth Documentation](https://better-auth.com/docs) - Official docs

---

**Last Updated**: November 23, 2025
