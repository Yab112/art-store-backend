import { Controller, Get } from '@nestjs/common';

@Controller('test')
export class TestController {
  @Get()
  getTest() {
    return {
      message: 'Better Auth integration is working!',
      timestamp: new Date().toISOString(),
      endpoints: {
        providers: '/api/auth/providers',
        session: '/api/auth/session',
        signIn: '/api/auth/sign-in',
        signUp: '/api/auth/sign-up',
      },
    };
  }

  @Get('auth-status')
  getAuthStatus() {
    return {
      status: 'Better Auth is configured and ready',
      features: [
        'JWT Sessions',
        'Email/Password Authentication',
        'Google OAuth (when database is connected)',
      ],
    };
  }
}
