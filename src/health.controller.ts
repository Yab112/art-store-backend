import { Controller, Get, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PrismaService } from "./core/database/prisma.service";
import { Public } from "./core/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
@Public()  
export class HealthController {
  private readonly startTime = Date.now(); 

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Service is healthy",
  })
  async getHealth() {
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);

    // Check database connectivity
    let databaseStatus = "unknown";
    let databaseResponseTime = 0;
    try {
      const dbStartTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      databaseResponseTime = Date.now() - dbStartTime;
      databaseStatus = "connected";
    } catch (error) {
      databaseStatus = "disconnected";
    }

    const isHealthy = databaseStatus === "connected";

    return {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        formatted: this.formatUptime(uptimeSeconds),
      },
      services: {
        database: {
          status: databaseStatus,
          responseTime: `${databaseResponseTime}ms`,
        },
      },
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };
  }

  @Get("liveness")
  @ApiOperation({ summary: "Liveness probe for Kubernetes/Docker" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Service is alive",
  })
  getLiveness() {
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("readiness")
  @ApiOperation({ summary: "Readiness probe for Kubernetes/Docker" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Service is ready",
  })
  async getReadiness() {
    // Check if database is accessible
    let databaseReady = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseReady = true;
    } catch (error) {
      databaseReady = false;
    }

    const isReady = databaseReady;

    return {
      status: isReady ? "ready" : "not ready",
      timestamp: new Date().toISOString(),
      services: {
        database: databaseReady ? "ready" : "not ready",
      },
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
  }
}
