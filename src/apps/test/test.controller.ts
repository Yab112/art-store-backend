import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@/core/guards/auth.guard";
import { Public } from "@/core/decorators/public.decorator";
import { PrismaService } from "@/core/database/prisma.service";
import {
  extractSessionCookieNames,
  normalizeAuthRequestHeaders,
} from "@/core/auth/auth-request.util";
import { auth } from "../../auth";

@Controller("test")
export class TestController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("auth-debug")
  async authDebug(@Request() req: any) {
    const normalizedHeaders = normalizeAuthRequestHeaders(
      req.headers as Record<string, string | string[] | undefined>,
    );
    const cookieHeader =
      typeof normalizedHeaders.cookie === "string"
        ? normalizedHeaders.cookie
        : "";
    const session = await auth.api.getSession({
      headers: normalizedHeaders as any,
    });
    const recentSessions = await this.prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });

    return {
      hasSession: Boolean(session?.user),
      userEmail: session?.user?.email ?? null,
      origin: req.headers.origin ?? null,
      hasAuthorization: Boolean(
        req.headers.authorization || req.headers.Authorization,
      ),
      sessionCookieNames: cookieHeader
        ? extractSessionCookieNames(cookieHeader)
        : [],
      cookieHeaderLength: cookieHeader.length,
      betterAuthUrl: process.env.BETTER_AUTH_URL ?? null,
      frontendUrl: process.env.FRONTEND_URL ?? null,
      cookieDomain: process.env.BETTER_AUTH_COOKIE_DOMAIN ?? null,
      recentSessions,
      hint: !session?.user
        ? "No session detected. Cross-origin cookies between arthopia.com.et and onrender.com are blocked by browsers. Point api.arthopia.com.et to Render and set BETTER_AUTH_COOKIE_DOMAIN=arthopia.com.et, or send Authorization: Bearer <token> from the frontend."
        : "Session is valid.",
    };
  }

  @Get("debug-user")
  @UseGuards(AuthGuard)
  async debugUser(@Request() req: any) {
    try {
      // Get session from Better Auth
      const session = await auth.api.getSession({
        headers: req.headers as any,
      });

      const sessionUserId = session?.user?.id;
      const sessionUserEmail = session?.user?.email;

      // Check if user exists by ID
      const userById = sessionUserId
        ? await this.prisma.user.findUnique({
            where: { id: sessionUserId },
            select: { id: true, email: true, name: true, createdAt: true },
          })
        : null;

      // Check if user exists by email
      const userByEmail = sessionUserEmail
        ? await this.prisma.user.findFirst({
            where: { email: sessionUserEmail },
            select: { id: true, email: true, name: true, createdAt: true },
          })
        : null;

      // Get all users (limit to 20 for readability)
      const allUsers = await this.prisma.user.findMany({
        select: { id: true, email: true, name: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      // Get user from request (from AuthGuard)
      const requestUser = req.user;

      return {
        success: true,
        debug: {
          session: {
            userId: sessionUserId,
            userEmail: sessionUserEmail,
            hasSession: !!session,
            hasUser: !!session?.user,
          },
          requestUser: {
            id: requestUser?.id,
            email: requestUser?.email,
            name: requestUser?.name,
          },
          database: {
            userById: userById
              ? {
                  id: userById.id,
                  email: userById.email,
                  name: userById.name,
                  createdAt: userById.createdAt,
                  found: true,
                }
              : { found: false },
            userByEmail: userByEmail
              ? {
                  id: userByEmail.id,
                  email: userByEmail.email,
                  name: userByEmail.name,
                  createdAt: userByEmail.createdAt,
                  found: true,
                  idMatches: userByEmail.id === sessionUserId,
                }
              : { found: false },
            allUsers: allUsers.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              createdAt: u.createdAt,
              idLength: u.id.length,
            })),
            totalUsers: allUsers.length,
          },
          analysis: {
            sessionUserIdExists: !!userById,
            sessionUserEmailExists: !!userByEmail,
            idMismatch:
              userByEmail && userByEmail.id !== sessionUserId
                ? {
                    sessionId: sessionUserId,
                    databaseId: userByEmail.id,
                    mismatch: true,
                  }
                : { mismatch: false },
            recommendation: !userById
              ? userByEmail
                ? "User exists with same email but different ID. Session user ID does not exist in database."
                : "User does not exist in database at all. Please sign up again."
              : "User exists in database. Foreign key constraint issue may be due to ID format mismatch.",
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
