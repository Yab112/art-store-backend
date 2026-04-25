
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        const artworkCount = await prisma.artwork.count();
        const talentCount = await prisma.talentType.count();
        const categoryCount = await prisma.category.count();

        console.log('--- DATABASE STATUS ---');
        console.log(`Users: ${userCount}`);
        console.log(`Artworks: ${artworkCount}`);
        console.log(`Talent Types: ${talentCount}`);
        console.log(`Categories: ${categoryCount}`);
        console.log('-----------------------');
    } catch (error) {
        console.error('Error connecting to database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
