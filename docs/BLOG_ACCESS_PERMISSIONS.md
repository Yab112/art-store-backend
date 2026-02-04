# Blog Access Permissions

## Overview
The blog module implements a clear separation between **viewing** and **actions**:
- **All users** (authenticated and unauthenticated) can **view** blog posts
- **Only authenticated users** can **take actions** (create, update, delete, vote, share, comment)

## Public Endpoints (No Authentication Required)

### View Blog Posts
All users can access these endpoints without authentication:

1. **GET `/api/blog`** - List all blog posts
   - Returns only APPROVED and published posts for unauthenticated users
   - Returns user's own drafts/pending posts if authenticated and requesting own posts
   - Query parameters: `page`, `limit`, `search`, `authorId`, `status`, `published`, `sortBy`, `sortOrder`

2. **GET `/api/blog/published`** - List published blog posts
   - Returns only published blog posts
   - Query parameters: `page`, `limit`, `search`, `sortBy`, `sortOrder`

3. **GET `/api/blog/:id`** - Get a single blog post by ID or slug
   - Returns a single blog post (must be APPROVED and published for unauthenticated users)
   - Query parameters: `incrementViews` (optional, to track views)

4. **GET `/api/blog/:id/comments`** - Get comments for a blog post
   - Returns all comments for a specific blog post
   - Query parameters: `page`, `limit`

5. **GET `/api/blog/:id/share-stats`** - Get share statistics
   - Returns share statistics for a blog post
   - No authentication required

## Protected Endpoints (Authentication Required)

### Blog Post Management
These endpoints require a valid authentication session:

1. **POST `/api/blog`** - Create a new blog post
   - Requires: Valid authentication
   - New posts start with status=PENDING and need admin approval

2. **PATCH `/api/blog/:id`** - Update a blog post
   - Requires: Valid authentication + ownership or admin role

3. **DELETE `/api/blog/:id`** - Delete a blog post
   - Requires: Valid authentication + ownership or admin role

4. **POST `/api/blog/:id/publish`** - Publish a blog post
   - Requires: Valid authentication + ownership or admin role

5. **POST `/api/blog/:id/unpublish`** - Unpublish a blog post
   - Requires: Valid authentication + admin role

6. **POST `/api/blog/:id/approve`** - Approve a blog post
   - Requires: Valid authentication + admin role

7. **POST `/api/blog/:id/reject`** - Reject a blog post
   - Requires: Valid authentication + admin role

### Comments
1. **POST `/api/blog/:id/comments`** - Create a comment
   - Requires: Valid authentication

2. **PATCH `/api/blog/comments/:commentId`** - Update a comment
   - Requires: Valid authentication + ownership

3. **DELETE `/api/blog/comments/:commentId`** - Delete a comment
   - Requires: Valid authentication + ownership

### Engagement
1. **POST `/api/blog/:id/vote`** - Vote (like/dislike) on a blog post
   - Requires: Valid authentication

2. **GET `/api/blog/:id/vote`** - Get user's vote on a blog post
   - Requires: Valid authentication

3. **POST `/api/blog/:id/share`** - Share a blog post
   - Requires: Valid authentication

## Implementation Details

### Authentication Guard
- The `AuthGuard` checks for the `@Public()` decorator on routes
- For public routes:
  - Attempts to retrieve session if available (for authenticated users)
  - Does NOT throw errors if no session exists (allows unauthenticated access)
  - Always returns `true` to allow access
- For protected routes:
  - Requires a valid Better Auth session
  - Throws `UnauthorizedException` if no session exists or user not found

### Content Filtering
The service layer applies appropriate filters based on authentication:

**For Unauthenticated Users:**
- Only shows blog posts with:
  - `status = "APPROVED"`
  - `published = true`

**For Authenticated Users (Non-Admin):**
- Viewing own posts: Shows all statuses (including PENDING, REJECTED)
- Viewing others' posts: Same as unauthenticated (only APPROVED + published)

**For Admin Users:**
- Can see all blog posts regardless of status or published state
- Can apply custom filters

## Testing Public Access

To verify that unauthenticated users can access the blog:

```bash
# Get all blog posts (no auth required)
curl http://localhost:3099/api/blog

# Get published blog posts (no auth required)
curl http://localhost:3099/api/blog/published

# Get a specific blog post (no auth required)
curl http://localhost:3099/api/blog/:id

# Get comments for a blog post (no auth required)
curl http://localhost:3099/api/blog/:id/comments
```

Expected: All requests should return 200 OK (or 404 if no posts exist)

To verify that actions require authentication:

```bash
# Try to create a blog post without auth (should fail)
curl -X POST http://localhost:3099/api/blog \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content"}'
```

Expected: 401 Unauthorized

## Troubleshooting

If unauthenticated users cannot access the blog:

1. **Check the logs**: Look for AuthGuard debug messages
2. **Verify no global guards**: Ensure no global AuthGuard is applied in `app.module.ts`
3. **Check CORS settings**: Ensure frontend origin is allowed in `main.ts`
4. **Verify database content**: Ensure there are blog posts with `status=APPROVED` and `published=true`
5. **Check environment**: Ensure Better Auth configuration is correct

## Related Files

- `/src/apps/blog/blog.controller.ts` - Blog controller with route definitions
- `/src/core/guards/auth.guard.ts` - Authentication guard implementation
- `/src/core/decorators/public.decorator.ts` - Public decorator definition
- `/src/apps/blog/blog.service.ts` - Blog service with content filtering logic
