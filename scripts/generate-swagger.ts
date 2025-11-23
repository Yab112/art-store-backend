#!/usr/bin/env ts-node
/**
 * Script to generate and validate Swagger/OpenAPI documentation
 * 
 * This script can be run to:
 * - Generate Swagger JSON schema
 * - Validate Swagger documentation completeness
 * - Export Swagger spec to file
 * 
 * Usage:
 *   pnpm ts-node scripts/generate-swagger.ts [--export] [--validate]
 */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { auth } from '../src/auth';

async function generateSwagger() { 
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Art Gallery API')
    .setDescription('Comprehensive marketplace API for Art Gallery application')
    .setVersion('1.0')
    .addServer('http://localhost:3000/api', 'Localhost')
    .addServer('http://localhost:3000', 'Localhost')
    .addServer(
      'https://art-store-backend-latest.onrender.com',
      'Production URL',
    )
    .addServer(
      'https://art-store-backend-latest.onrender.com/api',
      'Production API URL',
    )
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Artwork', 'Artwork management endpoints')
    .addTag('Collections', 'Collection management endpoints')
    .addTag('Profile', 'User profile management endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Upload', 'File upload endpoints')
    .addTag('Test', 'Test endpoints for development')
    .build();

  // Get Better-Auth OpenAPI schema
  const openAPISchema = await auth.api.generateOpenAPISchema();
  const document = SwaggerModule.createDocument(app, config);

  // Prefix Better-Auth paths with /auth and add Auth tag
  const prefixedPaths = Object.fromEntries(
    Object.entries(openAPISchema.paths).map(([path, schema]: [string, any]) => {
      if (schema) {
        Object.keys(schema).forEach((method) => {
          const operation = schema[method];
          if (operation && !operation.tags) {
            operation.tags = ['Auth'];
          } else if (operation && operation.tags) {
            operation.tags = ['Auth', ...operation.tags];
          }
        });
      }
      return [`/auth${path}`, schema];
    }),
  );

  // Merge into Nest Swagger doc
  document.paths = {
    ...document.paths,
    ...(prefixedPaths as any),
  };

  document.components = {
    ...document.components,
    ...(openAPISchema.components as any),
    schemas: {
      ...(document.components?.schemas || {}),
      ...(openAPISchema.components?.schemas || {}),
    },
  };

  return document;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldExport = args.includes('--export');
  const shouldValidate = args.includes('--validate');

  try {
    console.log('📚 Generating Swagger documentation...');
    const document = await generateSwagger();

    if (shouldExport) {
      const outputPath = join(process.cwd(), 'swagger.json');
      writeFileSync(outputPath, JSON.stringify(document, null, 2));
      console.log(`✅ Swagger schema exported to: ${outputPath}`);
    }

    if (shouldValidate) {
      console.log('🔍 Validating Swagger documentation...');
      
      // Check for endpoints without descriptions
      let missingDescriptions = 0;
      Object.values(document.paths).forEach((pathMethods: any) => {
        Object.values(pathMethods).forEach((operation: any) => {
          if (operation && !operation.summary && !operation.description) {
            missingDescriptions++;
            console.warn(`⚠️  Missing description for: ${operation.operationId || 'unknown'}`);
          }
        });
      });

      // Check for DTOs without properties documented
      const schemas = document.components?.schemas || {};
      let missingProperties = 0;
      Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
        if (schema.properties && Object.keys(schema.properties).length > 0) {
          Object.entries(schema.properties).forEach(([prop, propSchema]: [string, any]) => {
            if (!propSchema.description && !name.includes('Response')) {
              missingProperties++;
              if (missingProperties <= 10) { // Limit warnings
                console.warn(`⚠️  Property '${prop}' in '${name}' missing description`);
              }
            }
          });
        }
      });

      console.log(`\n📊 Validation Summary:`);
      console.log(`   Total paths: ${Object.keys(document.paths).length}`);
      console.log(`   Total schemas: ${Object.keys(schemas).length}`);
      console.log(`   Missing descriptions: ${missingDescriptions}`);
      console.log(`   Missing property docs: ${missingProperties > 10 ? `${missingProperties}+` : missingProperties}`);
      
      if (missingDescriptions === 0 && missingProperties === 0) {
        console.log('✅ All documentation is complete!');
      }
    }

    console.log('✅ Swagger documentation generated successfully!');
    console.log('\n💡 Tips:');
    console.log('   - Use --export to save swagger.json');
    console.log('   - Use --validate to check documentation completeness');
    console.log('   - View documentation at: http://localhost:3000/swagger');
    
  } catch (error) {
    console.error('❌ Error generating Swagger:', error);
    process.exit(1);
  }
}

main();

