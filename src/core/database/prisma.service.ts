import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // In Prisma 7, connection URL is passed via adapter or accelerateUrl
      // For now, we'll use the DATABASE_URL from environment
      // The prisma.config.ts file handles the connection for migrations
      log: ["error", "warn"],
    });
  }

  async onModuleInit(): Promise<void> {
    const maxRetries = 6; // Increased for Neon auto-pause (can take 10-30s to wake up)
    const baseDelay = 3000; // 3 seconds base delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          // Exponential backoff: 3s, 6s, 9s, 12s, 15s, 18s
          const delay = baseDelay * attempt;
          this.logger.log(
            `Retrying database connection (attempt ${attempt}/${maxRetries}) in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.log("Connecting to database...");
        }

        await this.$connect();
        this.logger.log("✅ Database connected successfully");
        return;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        if (error.code === "P1001") {
          // Neon database might be auto-paused, retry with delay
          if (!isLastAttempt) {
            this.logger.warn(
              `Database connection failed (attempt ${attempt}/${maxRetries}). This might be due to Neon auto-pause. Retrying in ${baseDelay * (attempt + 1)}ms...`,
            );
            continue;
          }

          // Last attempt failed
          this.logger.error(
            "❌ Failed to connect to database after retries:",
            error.message,
          );
          this.logger.error(
            "Database URL:",
            process.env.DATABASE_URL ? "Set (hidden)" : "Not set",
          );
          this.logger.error("Error code:", error.code);
          this.logger.error("");
          this.logger.error(
            "⚠️  Cannot reach database server. Possible causes:",
          );
          this.logger.error(
            "1. Database server is paused (Neon free tier auto-pauses after inactivity)",
          );
          this.logger.error(
            "   → Solution: Go to https://console.neon.tech and wake up your database",
          );
          this.logger.error("2. Network/firewall blocking connection");
          this.logger.error("3. Database credentials expired or incorrect");
          this.logger.error("4. Database server is down");
          this.logger.error("");
          this.logger.error(
            "💡 Quick fix: Visit your Neon dashboard and ensure the database is active, then restart the server.",
          );
        } else {
          // Other errors, don't retry
          this.logger.error("Failed to connect to database:", error.message);
          this.logger.error(
            "Database URL:",
            process.env.DATABASE_URL ? "Set (hidden)" : "Not set",
          );
          this.logger.error("Error code:", error.code);
        }

        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
