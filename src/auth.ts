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
      // Better-auth URL format can be:
      // - Full URL: http://backend/api/auth/verify-email?token=xxx
      // - Relative path: /api/auth/verify-email?token=xxx
      // We need to extract the token and create a frontend link
      try {
        // Handle both absolute and relative URLs
        let urlObj: URL;
        if (url.startsWith("http://") || url.startsWith("https://")) {
          urlObj = new URL(url);
        } else {
          // If relative, construct full URL using baseURL
          const baseURL =
            process.env.BETTER_AUTH_URL ||
            process.env.BACKEND_URL ||
            "http://localhost:3000";
          urlObj = new URL(url, baseURL);
        }

        const token = urlObj.searchParams.get("token");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        if (token) {
          // Create frontend verification link with token
          const verificationLink = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
          console.log("🔗 Verification link created:", verificationLink);
          await emailBridge.sendVerificationEmail({
            email: user.email,
            link: verificationLink,
          });
        } else {
          console.warn("⚠️ No token found in verification URL:", url);
          // Fallback to original URL if token extraction fails
          await emailBridge.sendVerificationEmail({
            email: user.email,
            link: url,
          });
        }
      } catch (error) {
        console.error("❌ Error parsing verification URL:", error, "URL:", url);
        // Fallback to original URL if parsing fails
        await emailBridge.sendVerificationEmail({
          email: user.email,
          link: url,
        });
      }
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
              `WARNING: User ${user.id} created by Better Auth but not found in database!`,
            );
          } else {
            console.log(
              `User ${user.id} verified in database: ${dbUser.email}`,
            );
          }
        },
      },
    },
  },

  // Social OAuth providers - Google only
  socialProviders: {
    google: {
      clientId: process.env.SERVER_GOOGLE_CLIENT_ID || "demo-client-id",
      clientSecret:
        process.env.SERVER_GOOGLE_CLIENT_SECRET || "demo-client-secret",
      accessType: "offline", // Get refresh token
      prompt: "select_account consent", // Always show account selector
    },
  },

  // Security configuration
  trustedOrigins: [
    "http://localhost:3000", // Backend (legacy)
    "http://localhost:3099", // Backend (current)
    "http://localhost:3001", // Admin dashboard (Next.js default)
    "http://localhost:3002", // Admin dashboard (alternative port)
    "http://localhost:5173", // Vite dev server (frontend - art-gallery)
    "http://localhost:5174", // Vite dev server (alternative)
    "http://13.48.104.231:3000", // Production backend URL (EC2)
    "https://art-store-frontend-flame.vercel.app",
    "https://www.arthopia.com.et", // Production frontend URL
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
  // IMPORTANT: This must match the actual public URL where your server is accessible
  baseURL: (() => {
    const port = process.env.PORT || "3099";
    const url =
      process.env.BETTER_AUTH_URL ||
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "http://13.48.104.231:3000"
        : `http://localhost:${port}`);
    console.log("🔐 Better Auth baseURL:", url);
    console.log("🔐 Better Auth NODE_ENV:", process.env.NODE_ENV);
    console.log("🔐 Better Auth PORT:", port);
    console.log("🔐 Better Auth BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);
    console.log("🔐 Better Auth BACKEND_URL:", process.env.BACKEND_URL);
    return url;
  })(),

  // Secret for encryption
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-key",

  // Disable telemetry for cleaner logs
  telemetry: {
    enabled: false,
  },

  // Logger configuration for debugging session issues
  logger: {
    level: "debug", // Set to "debug" to see detailed auth logs
    disabled: false,
    log: (level, message, ...args) => {
      // Custom logging to help debug session issues
      if (
        level === "error" ||
        level === "warn" ||
        message.includes("session") ||
        message.includes("cookie")
      ) {
        console.log(`[Better Auth ${level.toUpperCase()}]`, message, ...args);
      }
    },
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
    // Dynamically set cookie attributes based on baseURL protocol
    // CRITICAL: secure: true requires HTTPS, sameSite: "none" requires secure: true
    useSecureCookies: (() => {
      const port = process.env.PORT || "3099";
      const baseURL =
        process.env.BETTER_AUTH_URL ||
        process.env.BACKEND_URL ||
        (process.env.NODE_ENV === "production"
          ? "http://13.48.104.231:3000"
          : `http://localhost:${port}`);
      const isHTTPS = baseURL.startsWith("https://");
      console.log(
        "🔐 Better Auth useSecureCookies:",
        isHTTPS,
        "(baseURL:",
        baseURL,
        ")",
      );
      return isHTTPS;
    })(),
    defaultCookieAttributes: (() => {
      const port = process.env.PORT || "3099";
      const baseURL =
        process.env.BETTER_AUTH_URL ||
        process.env.BACKEND_URL ||
        (process.env.NODE_ENV === "production"
          ? "http://13.48.104.231:3000"
          : `http://localhost:${port}`);
      const isHTTPS = baseURL.startsWith("https://");

      // For HTTPS: use sameSite: "none" + secure: true (works for cross-origin)
      // For HTTP: use sameSite: "lax" + secure: false (won't work for cross-origin API requests)
      // Note: HTTP cross-origin cookies are fundamentally limited by browser security
      const attributes = isHTTPS
        ? {
            sameSite: "none" as const,
            secure: true,
            httpOnly: true,
            partitioned: true, // Required for cross-site cookies in modern browsers
          }
        : {
            sameSite: "lax" as const,
            secure: false,
            httpOnly: true,
          };

      console.log("🔐 Better Auth cookie attributes:", attributes);
      return attributes;
    })(),
    // Add logger to debug cookie issues
    logger: {
      level: "debug",
      disabled: false,
    },
  },
});

export type sessionUser = typeof auth.$Infer.Session;
export type User = sessionUser["user"];
