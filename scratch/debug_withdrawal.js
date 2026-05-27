require('dotenv').config({ path: 'env/local.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(withdrawals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
