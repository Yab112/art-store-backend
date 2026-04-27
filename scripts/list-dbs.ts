
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const databases = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false;`;
        console.log('--- DATABASES ---');
        console.log(databases);

        const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`;
        console.log('--- TABLES IN CURRENT DB ---');
        console.log(tables);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
