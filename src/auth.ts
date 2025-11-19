// import { betterAuth } from 'better-auth';
// import { prismaAdapter } from 'better-auth/adapters/prisma';
// import { PrismaClient } from '@prisma/client';
// import * as zod from 'zod';

// // Import Better Auth plugins
// import { twoFactor } from 'better-auth/plugins/two-factor';
// import {
//   admin as adminPlugin,
//   customSession,
//   openAPI,
// } from 'better-auth/plugins';
// import { emailBridge } from './libraries/email';

// const prisma = new PrismaClient();

// // Helper function to get user permissions based on role

// export const auth = betterAuth({
//   database: prismaAdapter(prisma, {
//     provider: 'postgresql',
//   }),

//   // Configure table names to match your existing schema
//   user: {
//     additionalFields: {
//       profileType: {
//         type: 'string',
//         input: true,
//       },
//     },
//   },

//   emailVerification: {
//     sendVerificationEmail: async ({ user, url }) => {
//       await emailBridge.sendVerificationEmail({
//         email: user.email,
//         link: url,
//       });
//     },
//   },

//   // Core authentication methods
//   emailAndPassword: {
//     enabled: true,
//     requireEmailVerification: true,
//     minPasswordLength: 8,
//     maxPasswordLength: 128,
//     sendResetPassword: async ({ user, url }) => {
//       await emailBridge.sendPasswordResetEmail({
//         email: user.email,
//         link: url,
//       });
//     },
//   },
//   // databaseHooks: {
//   //   user: {
//   //     create: {
//   //       after: async (user) => {
//   //         if (user.profileType === 'CLIENT') {
//   //           await prisma.clientProfile.create({
//   //             data: { userId: user.id, preferences: '' },
//   //           });
//   //         }
//   //       },
//   //     },
//   //   },
//   // },

//   // Social OAuth providers
//   socialProviders: {
//     google: {
//       clientId: process.env.SERVER_GOOGLE_CLIENT_ID || 'demo-client-id',
//       clientSecret:
//         process.env.SERVER_GOOGLE_CLIENT_SECRET || 'demo-client-secret',
//     },
//   },

//   // Security configuration
//   trustedOrigins: [
//     process.env.BETTER_AUTH_URL || 'http://localhost:3000',
//     'http://localhost:3001',
//     'https://art-store-backend-latest.onrender.com',
//   ],

//   // Rate limiting
//   rateLimit: {
//     window: 60, // 1 minute
//     max: 10, // 10 requests per window
//   },

//   // Base URL configuration
//   baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

//   // Secret for encryption
//   secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret-key',

//   // Disable telemetry for cleaner logs
//   telemetry: {
//     enabled: false,
//   },

//   // Plugins for extended functionality
//   plugins: [
//     // Custom session to include role in session response
//     customSession(async ({ user, session }) => {
//       // Get the full user data from database to access role
//       const fullUser = await prisma.user.findUnique({
//         where: { id: user.id },
//       });

//       const userRole = (fullUser as any)?.role || 'CLIENT';

//       return {
//         user: {
//           ...user,
//           role: userRole,
//         },
//         session,
//       };
//     }),
//     openAPI(),

//     // Two-Factor Authentication
//     twoFactor({
//       issuer: 'Finder App',
//       otpOptions: {
//         async sendOTP({ user, otp }) {
//           await emailBridge.send2FACodeEmail({
//             email: user.email,
//             code: otp,
//           });
//         },
//       },
//     }),
//     adminPlugin({
//       defaultRole: 'user',
//     }),
//   ],

//   // Advanced configuration
//   advanced: {
//     database: {
//       generateId: false, // Prisma will generate UUIDs via @default(uuid())
//     },
//     defaultCookieAttributes: {
//       sameSite: 'none',
//       secure: true,
//       partitioned: true,
//     },
//   },
// });

// export type sessionUser = typeof auth.$Infer.Session;
// export type User = sessionUser['user'];

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import * as zod from "zod";

// Import Better Auth plugins
import { twoFactor } from "better-auth/plugins/two-factor";
import { emailOTP } from "better-auth/plugins/email-otp";
import {
  admin as adminPlugin,
  customSession,
  openAPI,
} from "better-auth/plugins";
import { emailBridge } from "./libraries/email";

// Initialize PrismaClient with connection handling
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Ensure database connection is established
// PrismaClient connects lazily, but we can test the connection
prisma.$connect().catch((error) => {
  console.error('❌ Better Auth PrismaClient connection error:', error);
  console.error('This may cause authentication to fail. Please check your DATABASE_URL.');
});

// Helper function to get user permissions based on role

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Configure table names to match your existing schema
  user: {
    additionalFields: {
      profileType: {
        type: "string",
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Log user creation for debugging
          console.log("Better Auth user created:", {
            id: user.id,
            email: user.email,
            name: user.name,
          });

          // Verify user exists in database
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true },
          });

          if (!dbUser) {
            console.error(
              `WARNING: User ${user.id} created by Better Auth but not found in database!`
            );
          } else {
            console.log(
              `User ${user.id} verified in database: ${dbUser.email}`
            );
          }
        },
      },
    },
  },

  // Social OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.SERVER_GOOGLE_CLIENT_ID || "demo-client-id",
      clientSecret:
        process.env.SERVER_GOOGLE_CLIENT_SECRET || "demo-client-secret",
      accessType: "offline", // Get refresh token
      prompt: "select_account consent", // Always show account selector
    },
    facebook: {
      clientId: process.env.SERVER_FACEBOOK_CLIENT_ID || "demo-client-id",
      clientSecret:
        process.env.SERVER_FACEBOOK_CLIENT_SECRET || "demo-client-secret",
      scopes: ["email", "public_profile"],
      fields: ["id", "name", "email", "picture"],
    },
  },

  // Security configuration
  trustedOrigins: [
    "http://localhost:3000", // Backend
    "http://localhost:3001",
    "http://localhost:5173", // Vite dev server (frontend)
    "http://localhost:5174", // Vite dev server (alternative)
    "https://art-store-backend-latest.onrender.com", // Production backend URL
    "https://art-store-frontend-flame.vercel.app", // Production frontend URL
    process.env.FRONTEND_URL || "http://localhost:5173", // From environment
  ],

  // Rate limiting
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per window
  },

  // Base URL configuration - should be the backend origin only (without /api/auth)
  // Better Auth automatically handles the /api/auth path
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:3000",

  // Secret for encryption
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key",

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

      const userRole = (fullUser as any)?.role || "CLIENT";

      return {
        user: {
          ...user,
          role: userRole,
        },
        session,
      };
    }),
    openAPI(),

    // Email OTP for verification and password reset
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          await emailBridge.sendVerificationOTPEmail({
            email,
            code: otp,
          });
        } else if (type === "forget-password") {
          await emailBridge.sendPasswordResetOTPEmail({
            email,
            code: otp,
          });
        } else if (type === "sign-in") {
          await emailBridge.sendSignInOTPEmail({
            email,
            code: otp,
          });
        }
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
    }),

    // Two-Factor Authentication
    twoFactor({
      issuer: "Finder App",
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
      defaultRole: "user",
    }),
  ],

  // Advanced configuration
  advanced: {
    database: {
      generateId: false,
    },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },
});

export type sessionUser = typeof auth.$Infer.Session;
export type User = sessionUser["user"];
