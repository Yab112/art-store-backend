const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({ where: { name: 'Zior Ezedin' } });
    console.log(user);
    
    // Test the FedEx payload directly
    const origin = { zipCode: user.addressZipCode, country: user.addressCountry };
    const destination = { zipCode: '10001', country: 'US' }; // valid US zip
    
    console.log("Origin:", origin);
    console.log("Destination:", destination);
}

main().catch(console.error).finally(() => prisma.$disconnect());
