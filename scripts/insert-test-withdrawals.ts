import { PrismaClient, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting to insert test withdrawal data...\n');

  // Get all users from the database
  const users = await prisma.user.findMany({
    take: 5, // Get up to 5 users
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (users.length === 0) {
    console.error('❌ No users found in the database. Please create at least one user first.');
    process.exit(1);
  }

  console.log(`📋 Found ${users.length} user(s) in the database:`);
  users.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${user.id}`);
  });
  console.log('');

  // Get artworks for each user to extract their IBANs
  const usersWithArtworks = await Promise.all(
    users.map(async (user) => {
      const artworks = await prisma.artwork.findMany({
        where: { userId: user.id },
        select: { iban: true },
      });

      const ibans = [...new Set(artworks.map((a) => a.iban).filter(Boolean))];
      
      return {
        ...user,
        ibans: ibans.length > 0 ? ibans : null,
        artworkCount: artworks.length,
      };
    })
  );

  console.log('📋 Users with artworks and IBANs:');
  usersWithArtworks.forEach((user, index) => {
    if (user.ibans && user.ibans.length > 0) {
      console.log(`   ${index + 1}. ${user.name} - ${user.artworkCount} artwork(s), IBANs: ${user.ibans.join(', ')}`);
    } else {
      console.log(`   ${index + 1}. ${user.name} - ${user.artworkCount} artwork(s), ⚠️  No IBANs found`);
    }
  });
  console.log('');

  // Filter to only users who have artworks with IBANs
  const usersWithIbans = usersWithArtworks.filter((u) => u.ibans && u.ibans.length > 0);

  if (usersWithIbans.length === 0) {
    console.error('❌ No users found with artworks that have IBANs.');
    console.error('   The backend queries withdrawals by matching IBANs from artworks.');
    console.error('   Please ensure users have artworks with IBAN values set.');
    process.exit(1);
  }

  // Test withdrawal data
  const withdrawalData = [
    // Completed withdrawals
    { amount: 1250.00, status: 'COMPLETED' as PaymentStatus, daysAgo: 30 },
    { amount: 850.50, status: 'COMPLETED' as PaymentStatus, daysAgo: 25 },
    { amount: 2100.75, status: 'COMPLETED' as PaymentStatus, daysAgo: 20 },
    { amount: 3200.00, status: 'COMPLETED' as PaymentStatus, daysAgo: 15 },
    
    // Processing withdrawals
    { amount: 500.00, status: 'PROCESSING' as PaymentStatus, daysAgo: 5 },
    { amount: 1750.25, status: 'PROCESSING' as PaymentStatus, daysAgo: 3 },
    
    // Initiated withdrawals
    { amount: 300.00, status: 'INITIATED' as PaymentStatus, daysAgo: 2 },
    { amount: 950.00, status: 'INITIATED' as PaymentStatus, daysAgo: 1 },
    { amount: 1200.00, status: 'INITIATED' as PaymentStatus, daysAgo: 0 },
    
    // Failed withdrawals
    { amount: 600.00, status: 'FAILED' as PaymentStatus, daysAgo: 15 },
    { amount: 450.00, status: 'FAILED' as PaymentStatus, daysAgo: 10 },
  ];

  let insertedCount = 0;

  // Distribute withdrawals across users, using their actual IBANs from artworks
  for (let i = 0; i < withdrawalData.length; i++) {
    const userIndex = i % usersWithIbans.length;
    const user = usersWithIbans[userIndex];
    const data = withdrawalData[i];
    
    // Use the first IBAN from the user's artworks
    const payoutAccount = user.ibans![0];
    
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - data.daysAgo);
    const updatedAt = new Date(createdAt);
    updatedAt.setDate(updatedAt.getDate() + 1);

    try {
      await prisma.withdrawal.create({
        data: {
          userId: user.id,
          payoutAccount: payoutAccount,
          amount: data.amount,
          status: data.status,
          createdAt: createdAt,
          updatedAt: updatedAt,
        },
      });

      insertedCount++;
      console.log(`✅ Inserted withdrawal: $${data.amount.toFixed(2)} (${data.status}) for ${user.name} using IBAN: ${payoutAccount}`);
    } catch (error: any) {
      console.error(`❌ Failed to insert withdrawal for ${user.name}:`, error.message);
    }
  }

  console.log(`\n✨ Successfully inserted ${insertedCount} withdrawal(s)!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Users with IBANs: ${usersWithIbans.length}`);
  console.log(`   - Withdrawals: ${insertedCount}`);
  console.log(`\n🎉 Done! Withdrawals are now linked to users via their artwork IBANs.`);
  console.log(`   You can check the withdrawals in the artist details sheet.`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

