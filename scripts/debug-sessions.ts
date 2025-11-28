import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

const prisma = new PrismaClient();

async function debugSessions() {
  console.log("🔍 Debugging Better Auth Sessions\n");

  // 1. Check all sessions in database
  const sessions = await prisma.session.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`📊 Found ${sessions.length} sessions in database:\n`);

  sessions.forEach((session, index) => {
    console.log(`Session #${index + 1}:`);
    console.log(`  ID: ${session.id}`);
    console.log(`  Token: ${session.token}`);
    console.log(`  User: ${session.user.email} (${session.user.id})`);
    console.log(`  Expires: ${session.expiresAt}`);
    console.log(`  Created: ${session.createdAt}`);
    console.log(`  IP: ${session.ipAddress || "N/A"}`);
    console.log("");
  });

  // 2. Check the problematic token from the logs
  const problematicToken = "uWwzahdCebVf6kUJ5RxA1LZkbe0QOjHM";
  console.log("🔍 Checking Problematic Token from Logs:");
  console.log(`  Token: ${problematicToken}\n`);

  // Try to find by ID
  const sessionById = await prisma.session.findUnique({
    where: { id: problematicToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  // Try to find by token field
  const sessionByToken = await prisma.session.findFirst({
    where: { token: problematicToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (sessionById) {
    console.log("✅ Session found by ID in database!");
    console.log(`  User: ${sessionById.user.email} (${sessionById.user.name})`);
    console.log(`  Expires: ${sessionById.expiresAt}`);
    console.log(
      `  Is Expired: ${new Date() > sessionById.expiresAt ? "YES ⚠️" : "NO ✅"}`
    );
    console.log(`  Created: ${sessionById.createdAt}`);
  } else if (sessionByToken) {
    console.log("✅ Session found by token field in database!");
    console.log(`  ID: ${sessionByToken.id}`);
    console.log(
      `  User: ${sessionByToken.user.email} (${sessionByToken.user.name})`
    );
    console.log(`  Expires: ${sessionByToken.expiresAt}`);
    console.log(
      `  Is Expired: ${new Date() > sessionByToken.expiresAt ? "YES ⚠️" : "NO ✅"}`
    );
  } else {
    console.log("❌ Session NOT found in database (neither by ID nor token)");
    console.log("  This confirms the cookie is stale/invalid");
    console.log("  Solution: User needs to clear cookies and sign in again\n");

    // Check if there are any expired sessions that should be cleaned up
    const expiredSessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
      take: 5,
    });

    if (expiredSessions.length > 0) {
      console.log(
        `⚠️  Found ${expiredSessions.length} expired sessions (showing first 5):`
      );
      expiredSessions.forEach((s) => {
        console.log(`  - ${s.id} (expired: ${s.expiresAt})`);
      });
    }
  }
  console.log("");

  // 3. Parse a sample session cookie to show the format
  const sampleCookie =
    "7aON9QvXi7cN5W22aBoYB7O4cBy827eS.SmI0GbF5gaEv1pq+izKZDD4op+C+PveIS0/N+FqGUWc=";
  console.log("🍪 Sample Cookie Analysis:");
  console.log(`  Full Cookie: ${sampleCookie}`);

  const parts = sampleCookie.split(".");
  if (parts.length === 2) {
    console.log(`  Session Token (ID to lookup): ${parts[0]}`);
    console.log(`  Signature: ${parts[1]}`);
    console.log("");

    // Try to find this session
    const sessionExists = await prisma.session.findUnique({
      where: { id: parts[0] },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (sessionExists) {
      console.log("✅ Session found in database!");
      console.log(`  User: ${sessionExists.user.email}`);
      console.log(`  Expires: ${sessionExists.expiresAt}`);
    } else {
      console.log("❌ Session NOT found in database");
      console.log(
        "  This means the session token in the cookie does not match any session.id"
      );
    }
  }

  console.log("\n🔐 Secret Verification:");
  console.log(
    `  BETTER_AUTH_SECRET is set: ${process.env.BETTER_AUTH_SECRET ? "Yes" : "No (using fallback)"}`
  );
  console.log(
    `  Secret value: ${process.env.BETTER_AUTH_SECRET ? "[HIDDEN]" : "fallback-secret-key"}`
  );

  // 4. Check for session/token mismatches
  console.log("\n🔍 Checking for session/token consistency:");
  const mismatchedSessions = sessions.filter(
    (session) => session.id !== session.token
  );

  if (mismatchedSessions.length > 0) {
    console.log(
      `⚠️  Warning: Found ${mismatchedSessions.length} sessions where id !== token`
    );
    mismatchedSessions.forEach((session) => {
      console.log(`  Session ID: ${session.id}`);
      console.log(`  Session Token: ${session.token}`);
      console.log("");
    });
  } else {
    console.log("✅ All sessions have matching id and token fields");
  }

  // 5. Summary and recommendations
  console.log("\n📋 SUMMARY & RECOMMENDATIONS:");
  console.log("═".repeat(60));

  if (sessions.length > 0 && sessions.some((s) => s.id !== s.token)) {
    console.log("⚠️  ISSUE FOUND: Session schema mismatch!");
    console.log("");
    console.log("Current Schema:");
    console.log("  - id: UUID (generated by Prisma)");
    console.log("  - token: Session token (separate field)");
    console.log("");
    console.log("Better Auth Expects:");
    console.log("  - id: Session token (token IS the ID)");
    console.log("  - NO separate token field");
    console.log("");
    console.log("🔧 FIX REQUIRED:");
    console.log("1. Update Prisma schema to remove token field");
    console.log('2. Change generateId from "uuid" to true in auth.ts');
    console.log(
      "3. Run migration: npx prisma migrate dev --name fix_session_schema"
    );
    console.log("4. Clear all browser cookies");
    console.log("5. Users need to sign in again");
  } else if (sessions.length === 0) {
    console.log("ℹ️  No sessions found in database");
    console.log("   This is normal if no users are signed in");
  } else {
    console.log("✅ Schema looks correct - all sessions have id === token");
  }

  console.log("═".repeat(60));

  await prisma.$disconnect();
}

debugSessions().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
