# Swagger Documentation Scripts

## Overview

This directory contains scripts for:
1. Generating, exporting, and validating Swagger/OpenAPI documentation
2. Testing blog access permissions and authentication

## Available Scripts

### Swagger Documentation Scripts

### Generate Swagger Documentation

```bash
pnpm swagger:generate
```

Generates Swagger documentation without any output files. Useful for testing that the documentation compiles correctly.

### Export Swagger Schema

```bash
pnpm swagger:export
```

Generates and exports the Swagger JSON schema to `swagger.json` in the project root. Useful for:

- Importing into API testing tools (Postman, Insomnia)
- Generating client SDKs
- Version control of API documentation
- CI/CD integration

### Validate Swagger Documentation

```bash
pnpm swagger:validate
```

Validates the Swagger documentation for completeness:

- Checks for endpoints without descriptions
- Identifies DTO properties without documentation
- Provides a summary of documentation coverage

### Combined Usage

You can combine flags:

```bash
pnpm swagger:export --validate
```

This will export the schema and validate it in one command.

## Auto-Generating Documentation

The Swagger documentation is automatically generated when the application starts. However, you can use these scripts to:

1. **Validate documentation before committing**:

   ```bash
   pnpm swagger:validate
   ```

2. **Export documentation for external tools**:

   ```bash
   pnpm swagger:export
   ```

3. **Test documentation changes**:
   ```bash
   pnpm swagger:generate
   ```

## Best Practices

1. **Always document new endpoints**:
   - Add `@ApiOperation()` with summary and description
   - Add `@ApiResponse()` for all possible status codes
   - Use `@ApiBody()` for request DTOs
   - Use `@ApiProperty()` on all DTO fields

2. **Run validation before committing**:

   ```bash
   pnpm swagger:validate
   ```

3. **Update exported schema regularly**:
   - Export before major releases
   - Keep `swagger.json` in version control for API versioning

## Viewing Documentation

The Swagger UI is available at:

- **Local**: http://localhost:3000/swagger
- **Production**: https://your-domain.com/swagger

## Troubleshooting

If the script fails:

1. Ensure all dependencies are installed: `pnpm install`
2. Check that Prisma client is generated: `pnpm prisma:generate`
3. Verify TypeScript compiles: `pnpm type-check`
4. Check for missing Swagger decorators on controllers/DTOs

---

## Blog Access Test Script

### `test-blog-access.sh`

Tests that blog endpoints are properly configured for public and authenticated access.

#### What it tests:
- ✅ Public GET endpoints are accessible without authentication
- ✅ Protected POST/PATCH/DELETE endpoints require authentication

#### Usage:

```bash
# Test against local server (default: http://localhost:3099)
./scripts/test-blog-access.sh

# Test against custom URL
BASE_URL=http://your-server:3099 ./scripts/test-blog-access.sh

# Test against production
BASE_URL=https://your-domain.com ./scripts/test-blog-access.sh
```

#### Expected Output:

```
======================================
Blog Access Test Script
======================================
Base URL: http://localhost:3099
API Base: http://localhost:3099/api/blog

======================================
Testing Public Endpoints (No Auth)
======================================

Test 1: GET /api/blog (list all blogs)... PASS (HTTP 200)
Test 2: GET /api/blog/published (list published)... PASS (HTTP 200)

======================================
Testing Protected Endpoints (No Auth)
======================================

Test 3: POST /api/blog (create - should require auth)... PASS (HTTP 401)
Test 4: PATCH /api/blog/:id (update - should require auth)... PASS (HTTP 401)
Test 5: DELETE /api/blog/:id (delete - should require auth)... PASS (HTTP 401)
Test 6: POST /api/blog/:id/vote (vote - should require auth)... PASS (HTTP 401)
Test 7: POST /api/blog/:id/comments (comment - should require auth)... PASS (HTTP 401)
Test 8: POST /api/blog/:id/share (share - should require auth)... PASS (HTTP 401)

======================================
Test Results
======================================
Total Tests: 8
Passed: 8
Failed: 0

✓ All tests passed!

Blog access is configured correctly:
- Public endpoints are accessible without authentication
- Protected endpoints require authentication
```

#### Prerequisites:

- Server must be running
- `curl` must be installed
- Bash shell

#### Troubleshooting:

**Test fails with "Connection refused":**
- Ensure server is running: `npm run start:dev`
- Check the URL is correct

**Public endpoint tests fail with 401:**
- Check `@Public()` decorator is applied to GET endpoints
- Verify AuthGuard respects public routes
- Check server logs for errors

**Protected endpoint tests fail with 200 instead of 401:**
- Check `@UseGuards(AuthGuard)` is applied to action endpoints
- Verify `@Public()` decorator is NOT on protected endpoints
- This is a security issue - endpoints should require auth
