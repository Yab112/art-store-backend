import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, VERSION_NEUTRAL } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ConfigurationService } from "./core/configuration";
const cookieParser = require("cookie-parser");
import { CorsService } from "./core/cors";
import { LoggerService } from "./libraries/logger";
import { auth } from "./auth";
import {
  NestExpressApplication,
  ExpressAdapter,
} from "@nestjs/platform-express";
import { toNodeHandler } from "better-auth/node";
const express = require("express");
import * as cors from "cors";
import { join } from "path";

const normalizeOrigin = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/\/+$/, "");
};

const appendDomainVariants = (
  origins: string[],
  baseOrigin: string | undefined,
) => {
  if (!baseOrigin) {
    return;
  }

  origins.push(baseOrigin);

  try {
    const parsed = new URL(baseOrigin);
    if (parsed.hostname.startsWith("www.")) {
      origins.push(`${parsed.protocol}//${parsed.hostname.replace(/^www\./, "")}`);
    } else {
      origins.push(`${parsed.protocol}//www.${parsed.hostname}`);
    }
  } catch {
    // Ignore malformed env values and only use explicitly provided origin.
  }
};

async function bootstrap() {
  const server = express();
  const configuredFrontendUrl = normalizeOrigin(process.env.FRONTEND_URL);
  const configuredAdminFrontendUrl = normalizeOrigin(process.env.ADMIN_FRONTEND_URL);
  const allowlistedOrigins: string[] = [
    "http://localhost:5173", // Vite dev server (frontend)
    "http://localhost:3000", // Backend (legacy)
    "http://localhost:3099", // Backend (current)
    "http://localhost:3001", // Admin dashboard (Next.js default)
    "http://localhost:3002", // Admin dashboard (alternative port)
    "http://13.48.104.231:3000", // EC2 Production
    "https://art-store-backend-latest.onrender.com",
    "https://art-store-frontend-flame.vercel.app",
    "http://51.20.54.47:3100",
    "http://51.20.54.47:3000",
    "https://www.arthopia.com.et",
    "https://arthopia.com.et",
  ];

  appendDomainVariants(allowlistedOrigins, configuredFrontendUrl);
  appendDomainVariants(allowlistedOrigins, configuredAdminFrontendUrl);

  const allowedOrigins = new Set(
    allowlistedOrigins.map((origin) => normalizeOrigin(origin)).filter(Boolean),
  );

  server.use(
    cors({
      origin: (origin, callback) => {
        const requestOrigin = normalizeOrigin(origin);

        // Allow non-browser clients (no Origin header) and known frontend domains.
        if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Cookie",
        "x-user-id",
        "X-User-Id",
      ],
      credentials: true, // Allow credentials (cookies, authorization headers, etc.)
      preflightContinue: false,
      optionsSuccessStatus: 204,
    }),
  );

  // CRITICAL FIX: Clean duplicate better-auth.session_token cookies BEFORE Better Auth processes them
  // When browser has multiple session cookies (old + new), Better Auth picks the first (stale) one
  // This middleware ensures only the LAST (most recent) session token is sent to Better Auth
  server.use((req, res, next) => {
    if (req.headers.cookie && typeof req.headers.cookie === "string") {
      const cookieHeader = req.headers.cookie;

      // Extract all better-auth.session_token cookies
      const sessionTokenMatches = cookieHeader.match(
        /better-auth\.session_token=([^;]+)/g,
      );

      if (sessionTokenMatches && sessionTokenMatches.length > 1) {
        console.log(
          `[Cookie Cleaner] Found ${sessionTokenMatches.length} duplicate better-auth.session_token cookies. Using the LAST one (most recent).`,
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
          `[Cookie Cleaner] Cleaned cookie header - removed ${
            sessionTokenMatches.length - 1
          } duplicate session tokens`,
        );
      }
    }
    next();
  });

  server.all("/api/auth/*", toNodeHandler(auth));
  server.use(express.urlencoded({ extended: true }));
  server.use(express.json());

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    {
      logger: ["error", "warn", "log", "debug", "verbose"],
      bodyParser: false,
    },
  );

  app.useStaticAssets(join(__dirname, "..", "public"));
  const configurationService = app.get(ConfigurationService);
  const corsService = app.get(CorsService);
  const loggerService = app.get(LoggerService);
  const logger = loggerService.create({ name: "Bootstrap" });

  // Configure Helmet to allow Swagger
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
      originAgentCluster: false,
    }),
  );
  // app.enableCors(corsService.getOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );
  app.use(cookieParser());

  const port = configurationService.getPort();
  app.setGlobalPrefix("api");

  // 🔹 Swagger setup
  const config = new DocumentBuilder()
    .setTitle("Art Store API")
    .setDescription("Comprehensive marketplace API for Art Store application")
    .setVersion("1.0")
    .addServer("http://localhost:3099/api", "Localhost")
    .addServer("http://localhost:3099", "Localhost")
    .addServer(
      "https://art-store-backend-latest.onrender.com/",
      "Render Production URL",
    )
    .addServer(
      "https://art-store-backend-latest.onrender.com/api",
      "Render Production API URL",
    )
    .addServer("http://51.20.54.47:3099/api", "EC2 Production API")
    .addServer("http://51.20.54.47:3099", "EC2 Production (Root)")
    .build();

  // get Better-Auth OpenAPI schema
  let openAPISchema: any = { paths: {}, components: {} };
  try {
    openAPISchema = await auth.api.generateOpenAPISchema();
    logger.log("Better Auth OpenAPI schema generated successfully");
  } catch (error) {
    logger.warn("Failed to generate Better Auth OpenAPI schema:", error);
    // Continue without Better Auth schema
  }

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Log initial document state
  const initialPathCount = Object.keys(document.paths || {}).length;
  logger.log(`Initial Swagger document has ${initialPathCount} paths`);

  // prefix Better-Auth paths with /auth
  if (openAPISchema?.paths && Object.keys(openAPISchema.paths).length > 0) {
    const prefixedPaths = Object.fromEntries(
      Object.entries(openAPISchema.paths).map(([path, schema]) => [
        `/auth${path}`, // e.g. /auth/sign-up/email
        schema,
      ]),
    );

    // merge into Nest Swagger doc
    document.paths = {
      ...document.paths,
      ...(prefixedPaths as any), // ✅ use prefixed paths
    };

    if (openAPISchema.components) {
      document.components = {
        ...document.components,
        ...(openAPISchema.components as any),
        schemas: {
          ...(document.components?.schemas || {}),
          ...(openAPISchema.components?.schemas || {}),
        },
      };
    }
    logger.log(`Added ${Object.keys(prefixedPaths).length} Better Auth paths`);
  } else {
    logger.warn("Better Auth schema has no paths to add");
  }

  // Setup Swagger with custom options
  SwaggerModule.setup("swagger", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
    customSiteTitle: "Art Store API Documentation",
    customCss: ".swagger-ui .topbar { display: none }",
    customCssUrl: [], // important
    customJs: [],
  });

  // Log Swagger info
  const pathCount = Object.keys(document.paths || {}).length;
  logger.log(`📚 Swagger configured with ${pathCount} endpoints`);

  const signals = ["SIGTERM", "SIGINT"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.warn(`Received ${signal}, starting graceful shutdown`);
      await app.close();
      process.exit(0);
    });
  });

  await app.listen(port);
  logger.success(`🚀 Application started on port ${port} `);
  logger.log(
    `📚 API Documentation available at http://localhost:${port}/swagger`,
  );
  logger.log(`🌍 Environment: ${configurationService.getEnvironment()}`);
}

bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
