import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigurationService } from './core/configuration';
import * as cookieParser from 'cookie-parser';
import { CorsService } from './core/cors';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggerService } from './libraries/logger';
import { auth } from './auth';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { toNodeHandler } from 'better-auth/node';

async function bootstrap() {
  const server = express();

  // Create NestJS app with explicit bodyParser: false
  // Note: Don't use express.json() before Better Auth handler
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    {
      bodyParser: false,
    },
  );

  const configurationService = app.get(ConfigurationService);
  const corsService = app.get(CorsService);
  const loggerService = app.get(LoggerService);
  const logger = loggerService.create({ name: 'Bootstrap' });

  const corsOptions = corsService.getOptions();

  // Basic security middleware
  app.use(helmet());

  // CORS configuration - must be before Better Auth routes
  app.enableCors(corsOptions);

  // Mount Better Auth routes AFTER NestJS initialization and CORS setup
  // This ensures CORS headers are available for Better Auth endpoints
  // Important: Don't use express.json() before this handler
  server.all('/api/auth/*', toNodeHandler(auth));

  // Parse request bodies for other routes (after Better Auth handler)
  server.use(express.urlencoded({ extended: true }));
  server.use(express.json());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cookie parser
  app.use(cookieParser());
  const port = configurationService.getPort();

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Finder API')
    .setDescription('Comprehensive marketplace API for Finder application')
    .setVersion('1.0')
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      this.logger.warn(`Received ${signal}, starting graceful shutdown`);
      await app.close();
      process.exit(0);
    });
  });

  await app.listen(port);
  logger.success(`🚀 Application started on port ${port}`);
  logger.log(
    `📚 API Documentation available at http://localhost:${port}/swagger`,
  );
  logger.log(`🌍 Environment: ${configurationService.getEnvironment()}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
