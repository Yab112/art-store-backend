import { PrismaClient, ArtworkStatus, OrderStatus, PaymentStatus, CHAT_STATUS, DISPUTE_STATUS, ReportReason, ReportStatus, ReportTargetType, NOTIFICATION_TYPE, MESSAGE_TYPE, MESSAGE_STATUS, PAYMENT_STATUS } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with 12 rows per table...');

  // 1. Seed Users (12)
  console.log('\n📝 Seeding Users...');
  const users = [];
  for (let i = 1; i <= 12; i++) {
    const user = await prisma.user.create({
      data: {
        name: `User ${i}`,
        email: `user${i}@example.com`,
        role: i <= 2 ? 'ADMIN' : 'USER',
        emailVerified: i % 2 === 0,
        score: Math.random() * 100,
        banned: i === 12,
        banReason: i === 12 ? 'Violation of terms' : null,
        updatedAt: new Date(),
      },
    });
    users.push(user);
    console.log(`✅ Created user ${i}: ${user.email}`);
  }

  // 2. Seed Accounts (12)
  console.log('\n📝 Seeding Accounts...');
  for (let i = 0; i < 12; i++) {
    await prisma.account.create({
      data: {
        userId: users[i].id,
        accountId: `acc_${i}_${Date.now()}`,
        providerId: i % 2 === 0 ? 'google' : 'email',
        accessToken: `token_${i}`,
      },
    });
    console.log(`✅ Created account ${i + 1}`);
  }

  // 3. Seed Verifications (12)
  console.log('\n📝 Seeding Verifications...');
  for (let i = 0; i < 12; i++) {
    await prisma.verification.create({
      data: {
        id: `verify_${i}_${Date.now()}`,
        identifier: `verify_${i}@example.com`,
        value: `value_${i}_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✅ Created verification ${i + 1}`);
  }

  // 4. Seed Categories (12)
  console.log('\n📝 Seeding Categories...');
  const categories = [];
  const categoryNames = ['Painting', 'Sculpture', 'Photography', 'Digital Art', 'Drawing', 'Print', 'Mixed Media', 'Installation', 'Performance', 'Video Art', 'Textile', 'Ceramics'];
  for (let i = 0; i < 12; i++) {
    const category = await prisma.category.create({
      data: {
        name: categoryNames[i],
        description: `Description for ${categoryNames[i]}`,
        slug: categoryNames[i].toLowerCase().replace(/\s+/g, '-'),
      },
    });
    categories.push(category);
    console.log(`✅ Created category ${i + 1}: ${category.name}`);
  }

  // 5. Seed Artworks (12) with Categories
  console.log('\n📝 Seeding Artworks...');
  const artworks = [];
  const statuses: ArtworkStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SOLD'];
  for (let i = 0; i < 12; i++) {
    const artwork = await prisma.artwork.create({
      data: {
        title: `Artwork ${i + 1}`,
        artist: `Artist ${i + 1}`,
        support: 'Canvas',
        state: 'Excellent',
        yearOfArtwork: String(2020 + i),
        dimensions: { width: 50 + i * 10, height: 50 + i * 10, unit: 'cm' },
        isFramed: i % 2 === 0,
        weight: `${1 + i}kg`,
        handDeliveryAccepted: true,
        origin: 'Ethiopia',
        yearOfAcquisition: String(2023 + i),
        description: `Beautiful artwork ${i + 1} description`,
        desiredPrice: 1000 + i * 100,
        acceptPriceNegotiation: i % 2 === 0,
        accountHolder: `Account Holder ${i + 1}`,
        iban: `ET${String(i).padStart(22, '0')}`,
        bicCode: `ETBIC${i}`,
        acceptTermsOfSale: true,
        giveSalesMandate: true,
        photos: [`https://example.com/photo${i + 1}.jpg`],
        status: statuses[i % statuses.length],
        isApproved: statuses[i % statuses.length] === 'APPROVED',
        userId: users[i].id,
      } as any,
    });
    artworks.push(artwork);

    // Assign 1-3 random categories to each artwork
    const numCategories = Math.floor(Math.random() * 3) + 1;
    const selectedCategories = [];
    for (let j = 0; j < numCategories; j++) {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      if (!selectedCategories.find(c => c.id === randomCategory.id)) {
        selectedCategories.push(randomCategory);
        await prisma.artworkOnCategory.create({
          data: {
            artworkId: artwork.id,
            categoryId: randomCategory.id,
          },
        } as any);
      }
    }
    console.log(`✅ Created artwork ${i + 1}: ${artwork.title} with ${selectedCategories.length} categories`);
  }

  // 7. Seed Collections (12)
  console.log('\n📝 Seeding Collections...');
  const collections = [];
  for (let i = 0; i < 12; i++) {
    const collection = await prisma.collection.create({
      data: {
        name: `Collection ${i + 1}`,
        description: `Description for collection ${i + 1}`,
        visibility: i % 2 === 0 ? 'PUBLIC' : 'PRIVATE',
        createdBy: users[i].id,
      },
    });
    collections.push(collection);
    console.log(`✅ Created collection ${i + 1}`);
  }

  // 8. Seed CollectionOnArtwork (12)
  console.log('\n📝 Seeding CollectionOnArtwork...');
  for (let i = 0; i < 12; i++) {
    await prisma.collectionOnArtwork.create({
      data: {
        collectionId: collections[i].id,
        artworkId: artworks[i].id,
      },
    });
    console.log(`✅ Created collection-artwork link ${i + 1}`);
  }

  // 9. Seed Comments (12)
  console.log('\n📝 Seeding Comments...');
  for (let i = 0; i < 12; i++) {
    await prisma.comment.create({
      data: {
        artworkId: artworks[i].id,
        authorName: users[i].name,
        content: `This is a comment ${i + 1} on the artwork`,
      },
    });
    console.log(`✅ Created comment ${i + 1}`);
  }

  // 10. Seed Disputes (12)
  console.log('\n📝 Seeding Disputes...');
  const disputeStatuses: DISPUTE_STATUS[] = ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];
  for (let i = 0; i < 12; i++) {
    const artwork = artworks[i];
    const user = users[i];
    const targetUser = users[(i + 1) % users.length];
    await prisma.dispute.create({
      data: {
        id: `dispute_${i}_${Date.now()}`,
        artworkId: artwork.id,
        raisedById: user.id,
        targetUserId: targetUser.id,
        status: disputeStatuses[i % disputeStatuses.length],
        reason: `Dispute reason ${i + 1}`,
        description: `Dispute description ${i + 1}`,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created dispute ${i + 1}`);
  }

  // 11. Seed FeaturedContent (12)
  console.log('\n📝 Seeding FeaturedContent...');
  for (let i = 0; i < 12; i++) {
    await prisma.featuredContent.create({
      data: {
        label: `Featured ${i + 1}`,
        description: `Featured content description ${i + 1}`,
        artworkId: artworks[i].id,
      },
    });
    console.log(`✅ Created featured content ${i + 1}`);
  }

  // 12. Seed Interactions (12)
  console.log('\n📝 Seeding Interactions...');
  for (let i = 0; i < 12; i++) {
    await prisma.interaction.create({
      data: {
        artworkId: artworks[i].id,
        userId: users[i].id,
        type: i % 2 === 0 ? 'VIEW' : 'SHARE',
        metadata: { source: 'web' },
      },
    });
    console.log(`✅ Created interaction ${i + 1}`);
  }

  // 13. Seed Chats (12)
  console.log('\n📝 Seeding Chats...');
  const chats = [];
  const chatStatuses: CHAT_STATUS[] = ['OPEN', 'CLOSED', 'ARCHIVED'];
  for (let i = 0; i < 12; i++) {
    const client = users[i];
    const tasker = users[(i + 1) % users.length];
    const chat = await prisma.chat.create({
      data: {
        id: `chat_${i}_${Date.now()}`,
        clientId: client.id,
        taskerId: tasker.id,
        status: chatStatuses[i % chatStatuses.length],
        updatedAt: new Date(),
      },
    });
    chats.push(chat);
    console.log(`✅ Created chat ${i + 1}`);
  }

  // 14. Seed Messages (12)
  console.log('\n📝 Seeding Messages...');
  const messageTypes: MESSAGE_TYPE[] = ['TEXT', 'IMAGE', 'SYSTEM'];
  const messageStatuses: MESSAGE_STATUS[] = ['SENT', 'DELIVERED', 'READ'];
  for (let i = 0; i < 12; i++) {
    await prisma.message.create({
      data: {
        id: `message_${i}_${Date.now()}`,
        chatId: chats[i].id,
        senderId: users[i].id,
        receiverId: users[(i + 1) % users.length].id,
        content: `Message content ${i + 1}`,
        type: messageTypes[i % messageTypes.length],
        status: messageStatuses[i % messageStatuses.length],
      },
    });
    console.log(`✅ Created message ${i + 1}`);
  }

  // 15. Seed Notifications (12)
  console.log('\n📝 Seeding Notifications...');
  const notificationTypes: NOTIFICATION_TYPE[] = ['INFO', 'WARNING', 'ALERT', 'MESSAGE', 'SYSTEM'];
  for (let i = 0; i < 12; i++) {
    await prisma.notification.create({
      data: {
        id: `notification_${i}_${Date.now()}`,
        userId: users[i].id,
        type: notificationTypes[i % notificationTypes.length],
        message: `Notification message ${i + 1}`,
        entityId: artworks[i].id,
      },
    });
    console.log(`✅ Created notification ${i + 1}`);
  }

  // 16. Seed PaymentGateways (12)
  console.log('\n📝 Seeding PaymentGateways...');
  const gateways = [];
  const gatewayNames = ['Chapa', 'PayPal', 'Stripe', 'M-Pesa', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Mobile Money', 'Cryptocurrency', 'Apple Pay', 'Google Pay', 'Venmo'];
  for (let i = 0; i < 12; i++) {
    const gateway = await prisma.paymentGateway.create({
      data: {
        id: gatewayNames[i].toLowerCase().replace(/\s+/g, '_'),
        name: gatewayNames[i],
        enabled: i % 2 === 0,
        updatedAt: new Date(),
      },
    });
    gateways.push(gateway);
    console.log(`✅ Created payment gateway ${i + 1}: ${gateway.name}`);
  }

  // 17. Seed Orders (12)
  console.log('\n📝 Seeding Orders...');
  const orders = [];
  const orderStatuses: OrderStatus[] = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'];
  for (let i = 0; i < 12; i++) {
    const order = await prisma.order.create({
      data: {
        buyerEmail: `buyer${i}@example.com`,
        totalAmount: new Decimal(500 + i * 50),
        status: orderStatuses[i % orderStatuses.length],
        updatedAt: new Date(),
      },
    });
    orders.push(order);
    console.log(`✅ Created order ${i + 1}`);
  }

  // 18. Seed OrderItems (12)
  console.log('\n📝 Seeding OrderItems...');
  for (let i = 0; i < 12; i++) {
    await prisma.orderItem.create({
      data: {
        orderId: orders[i].id,
        artworkId: artworks[i].id,
        quantity: 1,
        price: new Decimal(500 + i * 50),
      },
    });
    console.log(`✅ Created order item ${i + 1}`);
  }

  // 19. Seed Transactions (12)
  console.log('\n📝 Seeding Transactions...');
  const transactionStatuses: PaymentStatus[] = ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED'];
  for (let i = 0; i < 12; i++) {
    await prisma.transaction.create({
      data: {
        orderId: orders[i].id,
        paymentGatewayId: gateways[i % gateways.length].id,
        status: transactionStatuses[i % transactionStatuses.length],
        amount: new Decimal(500 + i * 50),
        metadata: { source: 'web', paymentMethod: 'card' },
      },
    });
    console.log(`✅ Created transaction ${i + 1}`);
  }

  // 20. Seed Payments (12)
  console.log('\n📝 Seeding Payments...');
  const paymentStatuses: PAYMENT_STATUS[] = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
  for (let i = 0; i < 12; i++) {
    await prisma.payment.create({
      data: {
        id: `payment_${i}_${Date.now()}`,
        bookingId: `booking_${i}`,
        amount: 500 + i * 50,
        method: gateways[i % gateways.length].name,
        status: paymentStatuses[i % paymentStatuses.length],
      },
    });
    console.log(`✅ Created payment ${i + 1}`);
  }

  // 21. Seed Receipts (12)
  console.log('\n📝 Seeding Receipts...');
  for (let i = 0; i < 12; i++) {
    await prisma.receipt.create({
      data: {
        orderId: orders[i].id,
        pdfUrl: `https://example.com/receipts/receipt_${i + 1}.pdf`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✅ Created receipt ${i + 1}`);
  }

  // 22. Seed Reports (12)
  console.log('\n📝 Seeding Reports...');
  const reportReasons: ReportReason[] = ['SPAM', 'COPYRIGHT', 'ABUSE', 'INAPPROPRIATE', 'OTHER'];
  const reportStatuses: ReportStatus[] = ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED'];
  for (let i = 0; i < 12; i++) {
    const artwork = artworks[i];
    const user = users[i];
    await prisma.report.create({
      data: {
        targetId: artwork.id,
        targetType: ReportTargetType.ARTWORK,
        reporterId: user.id,
        reason: reportReasons[i % reportReasons.length],
        details: `Report details ${i + 1}`,
        status: reportStatuses[i % reportStatuses.length],
        resolved: i > 8,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created report ${i + 1}`);
  }

  // 23. Seed Reviews (12)
  console.log('\n📝 Seeding Reviews...');
  for (let i = 0; i < 12; i++) {
    const artwork = artworks[i];
    const user = users[i];
    await prisma.review.create({
      data: {
        id: `review_${i}_${Date.now()}`,
        artworkId: artwork.id,
        userId: user.id,
        rating: (i % 5) + 1,
        comment: `Review comment ${i + 1}`,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created review ${i + 1}`);
  }

  // 24. Seed Withdrawals (12)
  console.log('\n📝 Seeding Withdrawals...');
  const withdrawalStatuses: PaymentStatus[] = ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED'];
  for (let i = 0; i < 12; i++) {
    await prisma.withdrawal.create({
      data: {
        userId: users[i].id,
        payoutAccount: `ET${String(i).padStart(22, '0')}`,
        amount: new Decimal(100 + i * 50),
        status: withdrawalStatuses[i % withdrawalStatuses.length],
      },
    });
    console.log(`✅ Created withdrawal ${i + 1}`);
  }

  // 25. Seed CartItems (12)
  console.log('\n📝 Seeding CartItems...');
  for (let i = 0; i < 12; i++) {
    await prisma.cartItem.create({
      data: {
        userId: users[i].id,
        artworkId: artworks[i].id,
        quantity: 1 + (i % 3),
      },
    });
    console.log(`✅ Created cart item ${i + 1}`);
  }

  // 26. Seed Favorites (12)
  console.log('\n📝 Seeding Favorites...');
  for (let i = 0; i < 12; i++) {
    await prisma.favorite.create({
      data: {
        userId: users[i].id,
        artworkId: artworks[i].id,
      },
    });
    console.log(`✅ Created favorite ${i + 1}`);
  }

  // 27. Seed Policies (12)
  console.log('\n📝 Seeding Policies...');
  const policyTypes = ['TERMS', 'PRIVACY', 'REFUND', 'SHIPPING', 'RETURNS', 'COPYRIGHT', 'COMMUNITY', 'SELLER', 'BUYER', 'PAYMENT', 'ACCOUNT', 'CONTENT'];
  for (let i = 0; i < 12; i++) {
    await prisma.policy.create({
      data: {
        type: policyTypes[i],
        content: `Policy content for ${policyTypes[i]}`,
        version: `1.${i}`,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created policy ${i + 1}: ${policyTypes[i]}`);
  }

  console.log('\n✅ Seeding completed! All tables seeded with 12 rows each.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
