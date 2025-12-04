import { PrismaClient, OrderStatus, PaymentStatus, ArtworkStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting to insert test earnings data...\n');

  // Get users who have artworks
  const users = await prisma.user.findMany({
    take: 5,
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
    console.log(`   ${index + 1}. ${user.name} (${user.email})`);
  });
  console.log('');

  let ordersCreated = 0;
  let orderItemsCreated = 0;
  let artworksUpdated = 0;

  // For each user, create sold artworks and orders
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Get user's artworks (or create some if they don't have any)
    let artworks = await prisma.artwork.findMany({
      where: { userId: user.id },
      take: 3, // Use up to 3 artworks per user
    });

    if (artworks.length === 0) {
      console.log(`⚠️  User ${user.name} has no artworks. Skipping...`);
      continue;
    }

    console.log(`\n📦 Processing ${artworks.length} artwork(s) for ${user.name}...`);

    // Create orders and mark artworks as SOLD
    for (let j = 0; j < Math.min(artworks.length, 3); j++) {
      const artwork = artworks[j];
      const salePrice = Number(artwork.desiredPrice) || (500 + Math.random() * 2000); // Use artwork price or random
      const daysAgo = (i * 3 + j) * 7; // Spread sales over time

      try {
        // Create an order
        const order = await prisma.order.create({
          data: {
            buyerEmail: `buyer${i}${j}@example.com`,
            totalAmount: new Decimal(salePrice),
            status: 'PAID' as OrderStatus,
            createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });

        ordersCreated++;

        // Create order item linking artwork to order
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            artworkId: artwork.id,
            quantity: 1,
            price: new Decimal(salePrice),
          },
        });

        orderItemsCreated++;

        // Create transaction for the order
        await prisma.transaction.create({
          data: {
            orderId: order.id,
            status: 'COMPLETED' as PaymentStatus,
            amount: new Decimal(salePrice),
            createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });

        // Update artwork status to SOLD
        await prisma.artwork.update({
          where: { id: artwork.id },
          data: { status: 'SOLD' as ArtworkStatus },
        });

        artworksUpdated++;

        console.log(`   ✅ Created sale: ${artwork.title || 'Untitled'} - $${salePrice.toFixed(2)} (${daysAgo} days ago)`);
      } catch (error: any) {
        console.error(`   ❌ Failed to create sale for artwork ${artwork.id}:`, error.message);
      }
    }
  }

  console.log(`\n✨ Successfully created earnings data!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Orders created: ${ordersCreated}`);
  console.log(`   - Order items created: ${orderItemsCreated}`);
  console.log(`   - Artworks marked as SOLD: ${artworksUpdated}`);
  console.log(`\n🎉 Done! Earnings should now appear in the artist details sheet.`);
  console.log(`   Note: Earnings are calculated from artworks with status "SOLD"`);
  console.log(`   that are linked to orders with status "PAID".`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

