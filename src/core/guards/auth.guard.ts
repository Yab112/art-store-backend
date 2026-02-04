import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { auth } from "../../auth";
import { PrismaService } from "../database/prisma.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Route is public - try to get user from session but don't require it
      const request = context.switchToHttp().getRequest<Request>();
      try {
        // Clean duplicate cookies before calling getSession()
        let cookieHeader = request.headers.cookie;
        if (cookieHeader && typeof cookieHeader === "string") {
          const sessionTokenMatches = cookieHeader.match(
            /better-auth\.session_token=([^;]+)/g,
          );

          if (sessionTokenMatches && sessionTokenMatches.length > 1) {
            let cleanedCookies = cookieHeader
              .replace(/better-auth\.session_token=[^;]+;?/g, "")
              .trim();

            const lastSessionCookie =
              sessionTokenMatches[sessionTokenMatches.length - 1];
            cleanedCookies = cleanedCookies
              ? `${cleanedCookies}; ${lastSessionCookie}`
              : lastSessionCookie;

            request.headers.cookie = cleanedCookies;
          }
        }

        const session = await auth.api.getSession({
          headers: request.headers as any,
        });
        if (session?.user) {
          // Validate user exists in database
          const userExists = await this.prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, email: true, name: true },
          });
          if (userExists) {
            request["user"] = session.user;
            request["session"] = session;
          }
        }
      } catch (error) {
        // Ignore auth errors for public routes - they don't need authentication
        this.logger.debug(
          `Public route - authentication optional, error ignored: ${error.message}`,
        );
      }
      // Always allow access to public routes, even if session retrieval fails
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Debug: Log headers and cookies
      this.logger.debug("=== Auth Guard Debug ===");
      this.logger.debug(`Cookies: ${JSON.stringify(request.cookies || {})}`);
      this.logger.debug(`Cookie header: ${request.headers.cookie || "none"}`);
      this.logger.debug(
        `Authorization header: ${request.headers.authorization || "none"}`,
      );

      // CRITICAL FIX: Clean duplicate better-auth.session_token cookies before calling getSession()
      // This ensures Better Auth receives only the most recent session token
      let cookieHeader = request.headers.cookie;
      if (cookieHeader && typeof cookieHeader === "string") {
        const sessionTokenMatches = cookieHeader.match(
          /better-auth\.session_token=([^;]+)/g,
        );

        if (sessionTokenMatches && sessionTokenMatches.length > 1) {
          this.logger.debug(
            `[AuthGuard] Found ${sessionTokenMatches.length} duplicate better-auth.session_token cookies. Using the LAST one (most recent).`,
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

          // Update the request headers with cleaned cookies
          request.headers.cookie = cleanedCookies;

          this.logger.debug(
            `[AuthGuard] Cleaned cookie header - removed ${sessionTokenMatches.length - 1} duplicate session tokens`,
          );
        }
      }

      // Get the session from Better Auth
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      this.logger.debug(`Session: ${session ? "Found" : "Not found"}`);
      this.logger.debug(
        `User: ${session?.user ? session.user.id : "Not found"}`,
      );

      if (!session || !session.user) {
        this.logger.error("No valid session found");
        throw new UnauthorizedException("No valid session found");
      }

      // Validate that the user ID exists in the database
      // This ensures the user hasn't been deleted but session still exists
      this.logger.debug(
        `Checking if user exists in database: ${session.user.id}`,
      );

      const userExists = await this.prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true },
      });

      if (!userExists) {
        // Log all users to debug
        const allUsers = await this.prisma.user.findMany({
          select: { id: true, email: true },
          take: 5,
        });
        this.logger.error(
          `Session user ID ${session.user.id} does not exist in database`,
        );
        this.logger.error(`Session user email: ${session.user.email}`);
        this.logger.error(
          `Sample users in database: ${JSON.stringify(allUsers)}`,
        );
        throw new UnauthorizedException(
          `User account not found. Session user ID: ${session.user.id}, Email: ${session.user.email}. Please sign in again.`,
        );
      }

      this.logger.debug(
        `User found in database: ${userExists.id} (${userExists.email})`,
      );

      // Attach user and session to request for use in controllers
      request["user"] = session.user;
      request["session"] = session;

      this.logger.debug(
        `User authenticated: ${session.user.id} (${session.user.email})`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Auth failed: ${error.message}`);
      throw new UnauthorizedException("Invalid authentication");
    }
  }
}
