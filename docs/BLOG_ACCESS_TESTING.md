# Blog Access Testing Guide

## Quick Test: Verify Public Access Works

Run these commands to verify that unauthenticated users can access the blog:

### 1. Test GET /api/blog (List all blogs)
```bash
curl -X GET http://localhost:3099/api/blog \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Status: 200 OK
- Response contains list of blog posts (if any exist with status=APPROVED and published=true)
- No authentication required

### 2. Test GET /api/blog/published (List published blogs)
```bash
curl -X GET http://localhost:3099/api/blog/published \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Status: 200 OK
- Response contains list of published blog posts
- No authentication required

### 3. Test GET /api/blog/:id (Get single blog post)
```bash
# Replace :id with an actual blog post ID or slug
curl -X GET http://localhost:3099/api/blog/[BLOG_ID] \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Status: 200 OK (if blog exists and is APPROVED + published)
- Status: 404 Not Found (if blog doesn't exist)
- No authentication required

### 4. Test GET /api/blog/:id/comments (Get blog comments)
```bash
# Replace :id with an actual blog post ID
curl -X GET http://localhost:3099/api/blog/[BLOG_ID]/comments \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Status: 200 OK
- Response contains list of comments
- No authentication required

## Quick Test: Verify Actions Require Authentication

### 1. Test POST /api/blog (Create blog - should fail without auth)
```bash
curl -X POST http://localhost:3099/api/blog \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Blog Post",
    "content": "This is a test blog post content",
    "excerpt": "Test excerpt"
  }'
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message indicating authentication is required

### 2. Test POST /api/blog/:id/vote (Vote - should fail without auth)
```bash
curl -X POST http://localhost:3099/api/blog/[BLOG_ID]/vote \
  -H "Content-Type: application/json" \
  -d '{"type": "LIKE"}'
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message indicating authentication is required

### 3. Test POST /api/blog/:id/comments (Comment - should fail without auth)
```bash
curl -X POST http://localhost:3099/api/blog/[BLOG_ID]/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "Test comment"}'
```

**Expected Result:**
- Status: 401 Unauthorized
- Error message indicating authentication is required

## Testing with Authentication

### 1. Sign in to get session cookie
```bash
curl -X POST http://localhost:3099/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

### 2. Use session cookie for authenticated requests
```bash
# Create a blog post with authentication
curl -X POST http://localhost:3099/api/blog \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "My Blog Post",
    "content": "This is my blog post content",
    "excerpt": "My excerpt"
  }'
```

**Expected Result:**
- Status: 201 Created
- Response contains created blog post

## Common Issues and Solutions

### Issue 1: Empty Response / No Blog Posts

**Symptom:** API returns empty array `[]` when accessing `/api/blog`

**Cause:** No blog posts in database with `status=APPROVED` and `published=true`

**Solution:**
1. Check database for blog posts:
```sql
SELECT id, title, status, published FROM "BlogPost";
```

2. If posts exist but are PENDING, approve them:
   - Sign in as admin
   - Use `POST /api/blog/:id/approve` endpoint
   - Then use `POST /api/blog/:id/publish` endpoint

3. Or create a new approved and published blog post manually in database:
```sql
INSERT INTO "BlogPost" (id, title, content, slug, status, published, "publishedAt", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Welcome to Our Blog',
  'This is our first blog post!',
  'welcome-to-our-blog',
  'APPROVED',
  true,
  NOW(),
  '[USER_ID]',
  NOW(),
  NOW()
);
```

### Issue 2: 401 Unauthorized on Public Endpoints

**Symptom:** Getting 401 error when accessing `/api/blog` without authentication

**Cause:** AuthGuard not respecting `@Public()` decorator

**Solution:**
1. Check that `@Public()` decorator is imported correctly in blog controller
2. Verify Reflector is injected in AuthGuard
3. Check AuthGuard logs for errors
4. Ensure no global AuthGuard is applied without proper public route handling

### Issue 3: CORS Errors

**Symptom:** Browser shows CORS errors when accessing blog API from frontend

**Cause:** Frontend origin not allowed in CORS configuration

**Solution:**
1. Check `main.ts` CORS configuration
2. Add your frontend URL to the allowed origins list:
```typescript
origin: [
  "http://localhost:5173", // Your frontend URL
  process.env.FRONTEND_URL,
  // ... other origins
]
```

### Issue 4: Session Cookie Issues

**Symptom:** Authenticated users can't perform actions even with valid session

**Cause:** Cookie not being sent or Better Auth session issues

**Solution:**
1. Check that cookies are being sent with requests
2. Verify `credentials: 'include'` is set in frontend fetch requests
3. Check Better Auth configuration in `src/auth.ts`
4. Verify session cookie attributes (sameSite, secure, httpOnly)

## Environment-Specific Testing

### Local Development (HTTP)
```bash
# Test public access
curl http://localhost:3099/api/blog

# Test with session cookie
curl http://localhost:3099/api/blog \
  -b "better-auth.session_token=YOUR_SESSION_TOKEN"
```

### Production (HTTPS)
```bash
# Test public access
curl https://your-domain.com/api/blog

# Test with session cookie (secure flag required)
curl https://your-domain.com/api/blog \
  -b "better-auth.session_token=YOUR_SESSION_TOKEN"
```

## Debugging Tips

### 1. Enable Debug Logging
Set log level to debug in `src/auth.ts`:
```typescript
logger: {
  level: "debug",
  disabled: false,
}
```

### 2. Check Server Logs
When testing, watch the server logs for:
- `[BlogController]` - Blog controller logs
- `[AuthGuard]` - Authentication guard logs
- `[Better Auth]` - Better Auth logs

### 3. Test with Swagger UI
Navigate to `http://localhost:3099/swagger` and:
1. Try public endpoints without authentication
2. Use "Authorize" button to add session token
3. Try protected endpoints with authentication

### 4. Check Database State
```sql
-- Count blog posts by status
SELECT status, published, COUNT(*) 
FROM "BlogPost" 
GROUP BY status, published;

-- Check if any posts are visible to public
SELECT id, title, status, published 
FROM "BlogPost" 
WHERE status = 'APPROVED' AND published = true;
```

## Success Criteria

✅ **Public Access Working:**
- GET /api/blog returns 200 OK without authentication
- GET /api/blog/published returns 200 OK without authentication
- GET /api/blog/:id returns 200 OK for APPROVED + published posts
- GET /api/blog/:id/comments returns 200 OK without authentication

✅ **Protected Actions Working:**
- POST /api/blog returns 401 without authentication
- POST /api/blog/:id/vote returns 401 without authentication
- POST /api/blog/:id/comments returns 401 without authentication
- All protected endpoints return 200/201 with valid authentication

✅ **Content Filtering Working:**
- Unauthenticated users only see APPROVED + published posts
- Authenticated users can see their own drafts/pending posts
- Admin users can see all posts
