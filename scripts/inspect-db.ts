
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('ENV DATABASE_URL:', process.env.DATABASE_URL);
        const users = await prisma.user.findMany({ take: 5 });
        console.log('--- USERS IN DB ---');
        console.log(JSON.stringify(users, null, 2));
        console.log('-------------------');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
