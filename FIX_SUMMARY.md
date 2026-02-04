# Blog 401 Error Fix

## Problem
GET /api/blog was returning 401 Unauthorized for unauthenticated users.

## Root Cause
The blog controller was using `@Public()` decorator combined with `@UseGuards(AuthGuard)`, which was causing authentication failures.

## Solution
Followed the pattern established in artwork.controller.ts:
- Removed ALL `@Public()` decorators
- GET endpoints have NO auth decorators (naturally public)
- POST/PATCH/DELETE endpoints keep `@UseGuards(AuthGuard)` (protected)

## Before (BROKEN)
```typescript
@Get()
@Public()
@UseGuards(AuthGuard)
async findAll() { ... }
```

## After (FIXED)
```typescript
@Get()
async findAll() { ... }
```

## Pattern
Matches artwork API:
- **Public endpoints**: No decorators needed
- **Protected endpoints**: Only `@UseGuards(AuthGuard)`

## Endpoints Now Public
- GET /api/blog
- GET /api/blog/published
- GET /api/blog/:id
- GET /api/blog/:id/comments
- GET /api/blog/:id/share-stats

## Endpoints Protected
- All POST, PATCH, DELETE operations require authentication

## Result
✅ Unauthenticated users can now access blog content
✅ Authenticated users required for actions
✅ Follows consistent pattern across the API
