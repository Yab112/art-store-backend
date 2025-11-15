import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigurationService } from "./core/configuration";
const cookieParser = require("cookie-parser");
import { CorsService } from "./core/cors";
import helmet from "helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { LoggerService } from "./libraries/logger";
import { auth } from "./auth";
import {
  NestExpressApplication,
  ExpressAdapter,
} from "@nestjs/platform-express";
import { toNodeHandler } from "better-auth/node";
const express = require("express");
import * as cors from "cors";

async function bootstrap() {
  const server = express();
  server.use(
    cors({
      origin: [
        "http://localhost:5173", // Vite dev server (frontend)
        "http://localhost:3000", // Backend (for Swagger, etc.)
        "http://localhost:3001",
        "https://art-store-backend-latest.onrender.com",
        "https://art-store-frontend-flame.vercel.app",
        process.env.FRONTEND_URL || "http://localhost:5173",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true, // Allow credentials (cookies, authorization headers, etc.)
      preflightContinue: false,
      optionsSuccessStatus: 204,
    })
  );
  server.all("/api/auth/*", toNodeHandler(auth));
  server.use(express.urlencoded({ extended: true }));
  server.use(express.json());

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    {
      bodyParser: false,
    }
  );

  const configurationService = app.get(ConfigurationService);
  const corsService = app.get(CorsService);
  const loggerService = app.get(LoggerService);
  const logger = loggerService.create({ name: "Bootstrap" });

  app.use(helmet());
  app.enableCors(corsService.getOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    })
  );
  app.use(cookieParser());

  const port = configurationService.getPort();
  app.setGlobalPrefix("api");

  // 🔹 Swagger setup
  const config = new DocumentBuilder()
    .setTitle("Art Store API")
    .setDescription("Comprehensive marketplace API for Art Store application")
    .setVersion("1.0")
    .addServer("http://localhost:3000/api", "Localhost")
    .addServer("http://localhost:3000", "Localhost")
    .addServer(
      "https://art-store-backend-latest.onrender.com/",
      "Render Production URL"
    )
    .addServer(
      "https://art-store-backend-latest.onrender.com/api",
      "Render Production API URL"
    )
    .build();

  // get Better-Auth OpenAPI schema
  // get Better-Auth OpenAPI schema
  const openAPISchema = await auth.api.generateOpenAPISchema();
  const document = SwaggerModule.createDocument(app, config);

  // prefix Better-Auth paths with /auth
  const prefixedPaths = Object.fromEntries(
    Object.entries(openAPISchema.paths).map(([path, schema]) => [
      `/auth${path}`, // e.g. /auth/sign-up/email
      schema,
    ])
  );

  // merge into Nest Swagger doc
  document.paths = {
    ...document.paths,
    ...(prefixedPaths as any), // ✅ use prefixed paths
  };

  document.components = {
    ...document.components,
    ...(openAPISchema.components as any),
    schemas: {
      ...(document.components?.schemas || {}),
      ...(openAPISchema.components?.schemas || {}),
    },
  };

  SwaggerModule.setup("swagger", app, document);

  const signals = ["SIGTERM", "SIGINT"];
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
    `📚 API Documentation available at http://localhost:${port}/swagger`
  );
  logger.log(`🌍 Environment: ${configurationService.getEnvironment()}`);
}

bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
