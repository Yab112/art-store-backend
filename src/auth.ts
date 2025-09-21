import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

// Import Better Auth plugins
import { twoFactor } from 'better-auth/plugins/two-factor';
import {
  admin as adminPlugin,
  customSession,
  openAPI,
} from 'better-auth/plugins';
import { emailBridge } from './libraries/email';

const prisma = new PrismaClient();

// Helper function to get user permissions based on role

export const auth: any = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Configure table names to match your existing schema
  user: {
    additionalFields: {
      profileType: {
        type: 'string',
        input: true,
      },
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await emailBridge.sendVerificationEmail({
        email: user.email,
        link: url,
      });
    },
  },

  // Core authentication methods
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await emailBridge.sendPasswordResetEmail({
        email: user.email,
        link: url,
      });
    },
  },
  // databaseHooks: {
  //   user: {
  //     create: {
  //       after: async (user) => {
  //         if (user.profileType === 'CLIENT') {
  //           await prisma.clientProfile.create({
  //             data: { userId: user.id, preferences: '' },
  //           });
  //         }
  //       },
  //     },
  //   },
  // },

  // Social OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.SERVER_GOOGLE_CLIENT_ID || 'demo-client-id',
      clientSecret:
        process.env.SERVER_GOOGLE_CLIENT_SECRET || 'demo-client-secret',
    },
  },

  // Security configuration
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    'http://localhost:3001', // Frontend URL
  ],

  // Rate limiting
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per window
  },

  // Base URL configuration
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // Secret for encryption
  secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret-key',

  // Disable telemetry for cleaner logs
  telemetry: {
    enabled: false,
  },

  // Plugins for extended functionality
  plugins: [
    // Custom session to include role in session response
    customSession(async ({ user, session }) => {
      // Get the full user data from database to access role
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      const userRole = (fullUser as any)?.role || 'CLIENT';

      return {
        user: {
          ...user,
          role: userRole,
        },
        session,
      };
    }),
    openAPI(),

    // Two-Factor Authentication
    twoFactor({
      issuer: 'Finder App',
      otpOptions: {
        async sendOTP({ user, otp }) {
          await emailBridge.send2FACodeEmail({
            email: user.email,
            code: otp,
          });
        },
      },
    }),
    adminPlugin({
      defaultRole: 'user',
    }),
  ],

  // Advanced configuration
  advanced: {
    generateId: false,
    crossSubDomainCookies: {
      enabled: false,
    },
  },
});

export type sessionUser = typeof auth.$Infer.Session;
export type User = sessionUser['user'];
