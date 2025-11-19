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

const prisma = new PrismaClient();

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
    "http://localhost:3001", // Admin dashboard (Next.js default)
    "http://localhost:5173", // Vite dev server (frontend)
    "http://localhost:5174", // Vite dev server (alternative)
    "http://13.48.104.231:3000", // Production backend URL (EC2)
    "https://art-store-frontend-flame.vercel.app", // Production frontend URL
    process.env.FRONTEND_URL || "http://localhost:5173", // From environment
    process.env.ADMIN_FRONTEND_URL, // Admin dashboard URL from environment
  ].filter(Boolean), // Remove undefined values

  // Rate limiting
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per window
  },

  // Base URL configuration - should be the backend origin only (without /api/auth)
  // Better Auth automatically handles the /api/auth path
  // Get the public URL from environment or detect from NODE_ENV
  baseURL: (() => {
    // Priority: BETTER_AUTH_URL > BACKEND_URL > detect from NODE_ENV
    let baseURL: string;
    if (process.env.BETTER_AUTH_URL) {
      baseURL = process.env.BETTER_AUTH_URL;
    } else if (process.env.BACKEND_URL) {
      baseURL = process.env.BACKEND_URL;
    } else if (process.env.NODE_ENV === "production") {
      // For production, use EC2 URL
      baseURL = "http://13.48.104.231:3000";
    } else {
      // Default to localhost for development
      baseURL = "http://localhost:3000";
    }

    // Log the baseURL for debugging
    console.log("🔐 Better Auth baseURL configured:", baseURL);
    console.log("🔐 Better Auth NODE_ENV:", process.env.NODE_ENV);
    console.log("🔐 Better Auth BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);

    return baseURL;
  })(),

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
    defaultCookieAttributes: (() => {
      // Determine if we're using HTTPS
      const baseURL =
        process.env.BETTER_AUTH_URL ||
        process.env.BACKEND_URL ||
        (process.env.NODE_ENV === "production"
          ? "http://13.48.104.231:3000"
          : "http://localhost:3000");

      const isHTTPS = baseURL.startsWith("https");

      // For HTTP (like EC2), we need:
      // - secure: false (cookies can't be secure over HTTP)
      // - sameSite: "lax" (works for same-site and top-level navigation)
      //   Note: For cross-origin HTTP, we use "lax" which works for top-level navigation
      // For HTTPS, we can use:
      // - secure: true
      // - sameSite: "none" (required for cross-origin)
      // - partitioned: true (for better cross-site cookie handling)
      const cookieAttrs = {
        sameSite: isHTTPS ? ("none" as const) : ("lax" as const),
        secure: isHTTPS,
        partitioned: isHTTPS, // Only works with secure: true
      };

      console.log("🍪 Better Auth cookie attributes:", {
        baseURL,
        isHTTPS,
        ...cookieAttrs,
      });

      return cookieAttrs;
    })(),
  },
});

export type sessionUser = typeof auth.$Infer.Session;
export type User = sessionUser["user"];
