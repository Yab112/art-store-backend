import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "./core/guards/auth.guard";
import { PrismaService } from "./core/database/prisma.service";

@ApiTags("Test")
@Controller("test")
export class TestController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getTest() {
    return {
      message: "Better Auth integration is working!",
      timestamp: new Date().toISOString(),
      endpoints: {
        providers: "/api/auth/providers",
        session: "/api/auth/session",
        signIn: "/api/auth/sign-in",
        signUp: "/api/auth/sign-up",
      },
    };
  }

  @Get("auth-status")
  getAuthStatus() {
    return {
      status: "Better Auth is configured and ready",
      features: [
        "JWT Sessions",
        "Email/Password Authentication",
        "Google OAuth (when database is connected)",
      ],
    };
  }

  @Get("debug-user")
  @UseGuards(AuthGuard)
  async debugUser(@Request() req: any) {
    const sessionUserId = req.user?.id;
    const sessionUserEmail = req.user?.email;

    // Check if user exists in database
    const userInDb = await this.prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, email: true, name: true, role: true },
    });

    // Find user by email
    const userByEmail = await this.prisma.user.findUnique({
      where: { email: sessionUserEmail },
      select: { id: true, email: true, name: true, role: true },
    });

    // Get all users to see what's in the database
    const allUsers = await this.prisma.user.findMany({
      select: { id: true, email: true, name: true },
      take: 10,
    });

    return {
      sessionUser: {
        id: sessionUserId,
        email: sessionUserEmail,
        fullUser: req.user,
      },
      userFoundById: userInDb,
      userFoundByEmail: userByEmail,
      allUsersInDatabase: allUsers,
      issue: userInDb
        ? "No issue - user exists"
        : "USER ID MISMATCH - Session user ID not found in database",
    };
  }
}
