import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.argv[2] || "admin@example.com";

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }, 
    });

    if (existingUser) {
      // Update existing user to ADMIN
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { role: "ADMIN" },
      });
      console.log("✅ User updated to ADMIN:", updatedUser.email);
    } else {
      console.log(
        "❌ User not found. Please sign up first, then run this script."
      );
      console.log(`   Or create user manually with email: ${email}`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect(); 
  }
}

createAdmin();
