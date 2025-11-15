# Swagger Documentation Scripts

## Overview

This directory contains scripts for generating, exporting, and validating Swagger/OpenAPI documentation for the Art Gallery API.

## Available Scripts

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

