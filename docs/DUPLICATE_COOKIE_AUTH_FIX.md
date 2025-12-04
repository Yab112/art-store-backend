# Duplicate Cookie Authentication Fix

## Problem Summary

Users were experiencing authentication failures where Better Auth's `getSession()` would return `null` even though:

- ✅ Session tokens existed in browser cookies
- ✅ Sessions existed in the database
- ✅ Cookies were being sent to the backend
- ✅ AuthGuard was successfully authenticating users

## Root Cause

The issue was caused by **duplicate `better-auth.session_token` cookies** in the browser. When users signed in multiple times or when sessions were refreshed, the browser would accumulate multiple session cookies:

```
Cookie Header:
better-auth.session_token=OLD_TOKEN.SIGNATURE; ...other cookies...; better-auth.session_token=NEW_TOKEN.SIGNATURE
```

### Why This Caused Failures

1. **Better Auth's Session Endpoint (`/api/auth/session`)**:
   - The frontend calls this endpoint to check authentication status
   - Better Auth's handler receives the raw cookie header with **both** tokens
   - When parsing cookies, Better Auth picks the **first** token it encounters
   - If the first token is stale (expired or deleted), Better Auth returns `null`

2. **AuthGuard (Protected Routes)**:
   - Initially had the same issue
   - We fixed it by cleaning duplicate cookies before calling `auth.api.getSession()`
   - However, Better Auth's own endpoints bypass the AuthGuard

### Example Scenario

```
Browser Cookies:
1. better-auth.session_token=7aON9QvXi7cN5W22aBoYB7O4cBy827eS.SIGNATURE (OLD - not in DB)
2. better-auth.session_token=aZWgaqn8rzmanH8KTOCETCA7CM6n79vp.SIGNATURE (NEW - exists in DB)

Better Auth receives:
Cookie: better-auth.session_token=7aON9QvXi7cN5W22aBoYB7O4cBy827eS.SIGNATURE; ...; better-auth.session_token=aZWgaqn8rzmanH8KTOCETCA7CM6n79vp.SIGNATURE

Better Auth parses and uses: 7aON9QvXi7cN5W22aBoYB7O4cBy827eS (FIRST one)
Database lookup: WHERE token = '7aON9QvXi7cN5W22aBoYB7O4cBy827eS'
Result: ❌ NOT FOUND → Returns null session
```

## Solution

We implemented a **cookie cleaning middleware** that runs **before** Better Auth processes any requests. This middleware:

1. Detects duplicate `better-auth.session_token` cookies
2. Removes all duplicates
3. Keeps only the **last** (most recent) session token
4. Passes the cleaned cookie header to Better Auth

### Implementation

**File**: `src/main.ts`

```typescript
// CRITICAL FIX: Clean duplicate better-auth.session_token cookies BEFORE Better Auth processes them
// When browser has multiple session cookies (old + new), Better Auth picks the first (stale) one
// This middleware ensures only the LAST (most recent) session token is sent to Better Auth
server.use((req, res, next) => {
  if (req.headers.cookie && typeof req.headers.cookie === "string") {
    const cookieHeader = req.headers.cookie;

    // Extract all better-auth.session_token cookies
    const sessionTokenMatches = cookieHeader.match(
      /better-auth\.session_token=([^;]+)/g
    );

    if (sessionTokenMatches && sessionTokenMatches.length > 1) {
      console.log(
        `[Cookie Cleaner] Found ${sessionTokenMatches.length} duplicate better-auth.session_token cookies. Using the LAST one (most recent).`
      );

      // Remove all better-auth.session_token cookies from the header
      let cleanedCookies = cookieHeader
        .replace(/better-auth\.session_token=[^;]+;?/g, "")
        .trim();

      // Add only the LAST (most recent) session token cookie
      const lastSessionCookie =
        sessionTokenMatches[sessionTokenMatches.length - 1];
      cleanedCookies = cleanedCookies
        ? `${cleanedCookies}; ${lastSessionCookie}`
        : lastSessionCookie;

      req.headers.cookie = cleanedCookies;

      console.log(
        `[Cookie Cleaner] Cleaned cookie header - removed ${sessionTokenMatches.length - 1} duplicate session tokens`
      );
    }
  }
  next();
});

server.all("/api/auth/*", toNodeHandler(auth));
```

### Why This Works

1. **Middleware Order**: The cookie cleaning middleware runs **before** Better Auth's handler (`/api/auth/*`)
2. **Last Token Priority**: We keep the **last** token because browsers typically append new cookies at the end
3. **Transparent**: The middleware only modifies the cookie header if duplicates are detected
4. **Comprehensive**: Fixes both Better Auth's endpoints AND routes protected by AuthGuard

## Additional Fixes

### AuthGuard Cookie Cleaning

We also enhanced the `AuthGuard` (`src/core/guards/auth.guard.ts`) to handle duplicate cookies when calling `auth.api.getSession()` directly:

```typescript
// Extract all better-auth.session_token cookies
const sessionTokenMatches = cookieHeader.match(
  /better-auth\.session_token=([^;]+)/g
);

if (sessionTokenMatches && sessionTokenMatches.length > 1) {
  // Remove all duplicates and keep only the last one
  // ... (similar logic)
}
```

This ensures that even if the middleware somehow misses a case, the AuthGuard has a fallback.

## Testing

### Before Fix

- Frontend `useSession()` hook returns `null`
- User appears logged out even after signing in
- Protected API routes work (AuthGuard fixed) but frontend session check fails

### After Fix

- Frontend `useSession()` hook returns valid session
- User authentication state is correctly reflected
- Both Better Auth endpoints and protected routes work correctly

## Prevention

### For Users

- Clear browser cookies if experiencing authentication issues
- Sign out properly instead of just closing the browser

### For Developers

- The middleware automatically handles duplicate cookies
- No additional action needed for new sessions
- Old sessions will naturally expire and be cleaned up

## Related Files

- `src/main.ts` - Cookie cleaning middleware
- `src/core/guards/auth.guard.ts` - AuthGuard with duplicate cookie handling
- `src/auth.ts` - Better Auth configuration

## Logs

When duplicate cookies are detected, you'll see logs like:

```
[Cookie Cleaner] Found 2 duplicate better-auth.session_token cookies. Using the LAST one (most recent).
[Cookie Cleaner] Cleaned cookie header - removed 1 duplicate session tokens
```

## Technical Details

### Cookie Format

Better Auth uses signed cookies:

```
better-auth.session_token={TOKEN}.{HMAC_SIGNATURE}
```

Example:

```
better-auth.session_token=aZWgaqn8rzmanH8KTOCETCA7CM6n79vp.Df4V0G1x9K+DodbPpE5niArU/23sUD7DpXYBR9Twsfw=
```

The middleware preserves the full cookie value (token + signature) when cleaning.

### Why Multiple Cookies Occur

1. **Session Refresh**: Better Auth may create new sessions without immediately deleting old ones
2. **Multiple Sign-ins**: User signs in from different tabs/devices
3. **Cookie Expiration**: Old cookies may not be immediately cleared by the browser
4. **Development**: Hot reloading or server restarts during development

## Conclusion

This fix ensures that Better Auth always receives the most recent, valid session token, preventing authentication failures caused by stale cookies. The solution is transparent to users and automatically handles edge cases.

---

**Date**: November 23, 2025  
**Status**: ✅ Resolved  
**Impact**: High - Fixes authentication failures for all users
