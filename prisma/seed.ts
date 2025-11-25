import {
  PrismaClient,
  ArtworkStatus,
  OrderStatus,
  PaymentStatus,
  CHAT_STATUS,
  DISPUTE_STATUS,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  NOTIFICATION_TYPE,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  PAYMENT_STATUS,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with 12 rows per table...");

  // 0. Seed Talent Types
  console.log("\n📝 Seeding Talent Types...");
  const talentTypes = [];
  const talentTypeData = [
    {
      name: "Painter",
      slug: "painter",
      description: "Traditional and digital painters",
      image: "talent-types/painter.png", // S3 object key
      sortOrder: 1,
    },
    {
      name: "Photographer",
      slug: "photographer",
      description: "Professional and artistic photographers",
      image: "talent-types/photographer.png", // S3 object key
      sortOrder: 2,
    },
    {
      name: "Digital Artist",
      slug: "digital-artist",
      description: "Digital art creators and illustrators",
      image: "talent-types/digital-artist.png", // S3 object key
      sortOrder: 3,
    },
    {
      name: "Sculptor",
      slug: "sculptor",
      description: "Sculpture artists working with various materials",
      image: "talent-types/sculptor.png", // S3 object key
      sortOrder: 4,
    },
    {
      name: "Calligrapher",
      slug: "calligrapher",
      description: "Calligraphy and lettering artists",
      image: "talent-types/calligrapher.png", // S3 object key
      sortOrder: 5,
    },
    {
      name: "Tattoo Artist",
      slug: "tattoo-artist",
      description: "Professional tattoo artists",
      image: "talent-types/tattoo-artist.png", // S3 object key
      sortOrder: 6,
    },
    {
      name: "Fashion Designer",
      slug: "fashion-designer",
      description: "Fashion and textile designers",
      image: "talent-types/fashion-designer.png", // S3 object key
      sortOrder: 7,
    },
    {
      name: "Mixed Media",
      slug: "mixed-media",
      description: "Artists working with multiple mediums",
      image: "talent-types/mixed-media.png", // S3 object key
      sortOrder: 8,
    },
    {
      name: "Illustrator",
      slug: "illustrator",
      description: "Illustration and graphic design artists",
      image: "talent-types/illustrator.png", // S3 object key
      sortOrder: 9,
    },
    {
      name: "Ceramicist",
      slug: "ceramicist",
      description: "Pottery and ceramic artists",
      image: "talent-types/ceramicist.png", // S3 object key
      sortOrder: 10,
    },
    {
      name: "Street Artist",
      slug: "street-artist",
      description: "Graffiti and street art creators",
      image: "talent-types/street-artist.png", // S3 object key
      sortOrder: 11,
    },
    {
      name: "Other",
      slug: "other",
      description: "Other artistic talents",
      image: "talent-types/other.png", // S3 object key
      sortOrder: 12,
    },
  ];

  for (const talentTypeInfo of talentTypeData) {
    const talentType = await prisma.talentType.upsert({
      where: { slug: talentTypeInfo.slug },
      update: {},
      create: {
        name: talentTypeInfo.name,
        slug: talentTypeInfo.slug,
        description: talentTypeInfo.description,
        image: talentTypeInfo.image,
        isActive: true,
        sortOrder: talentTypeInfo.sortOrder,
      },
    });
    talentTypes.push(talentType);
    console.log(`✅ Created/Updated talent type: ${talentType.name}`);
  }

  // 1. Seed Users (12)
  console.log("\n📝 Seeding Users...");
  const users = [];
  for (let i = 1; i <= 12; i++) {
    const user = await prisma.user.upsert({
      where: { email: `user${i}@example.com` },
      update: {},
      create: {
        name: `User ${i}`,
        email: `user${i}@example.com`,
        role: i <= 2 ? "ADMIN" : "USER",
        emailVerified: i % 2 === 0,
        score: Math.random() * 100,
        banned: i === 12,
        banReason: i === 12 ? "Violation of terms" : null,
        updatedAt: new Date(),
      },
    });
    users.push(user);
    console.log(`✅ Created/Updated user ${i}: ${user.email}`);
  }

  // 2. Seed Accounts (12)
  console.log("\n📝 Seeding Accounts...");
  for (let i = 0; i < 12; i++) {
    try {
      await prisma.account.create({
        data: {
          userId: users[i].id,
          accountId: `acc_${i}_seed`,
          providerId: i % 2 === 0 ? "google" : "email",
          accessToken: `token_${i}`,
        },
      });
      console.log(`✅ Created account ${i + 1}`);
    } catch (error: any) {
      if (error.code === "P2002") {
        console.log(`⏭️  Account ${i + 1} already exists, skipping...`);
      } else {
        throw error;
      }
    }
  }

  // 3. Seed Verifications (12)
  console.log("\n📝 Seeding Verifications...");
  for (let i = 0; i < 12; i++) {
    const verificationId = `verify_${i}_seed`;
    try {
      await prisma.verification.upsert({
        where: { id: verificationId },
        update: {},
        create: {
          id: verificationId,
          identifier: `verify_${i}@example.com`,
          value: `value_${i}_seed`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      console.log(`✅ Created/Updated verification ${i + 1}`);
    } catch (error: any) {
      if (error.code === "P2002") {
        console.log(`⏭️  Verification ${i + 1} already exists, skipping...`);
      } else {
        throw error;
      }
    }
  }

  // 4. Seed Categories (12)
  console.log("\n📝 Seeding Categories...");
  const categories = [];
  const categoryData = [
    {
      name: "Painting",
      description: "Oil, acrylic, watercolor, and mixed media paintings",
      slug: "painting",
      image:
        "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop",
    },
    {
      name: "Sculpture",
      description: "Three-dimensional artworks in various materials",
      slug: "sculpture",
      image:
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop",
    },
    {
      name: "Photography",
      description: "Fine art and documentary photography",
      slug: "photography",
      image:
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&h=300&fit=crop",
    },
    {
      name: "Digital Art",
      description: "Digital illustrations, NFTs, and computer-generated art",
      slug: "digital-art",
      image:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop",
    },
    {
      name: "Drawing",
      description: "Pencil, charcoal, ink, and pastel drawings",
      slug: "drawing",
      image:
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
    },
    {
      name: "Print",
      description: "Lithographs, screen prints, and etchings",
      slug: "print",
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400&h=300&fit=crop",
    },
    {
      name: "Mixed Media",
      description: "Artworks combining multiple materials and techniques",
      slug: "mixed-media",
      image:
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    },
    {
      name: "Installation",
      description: "Large-scale immersive art installations",
      slug: "installation",
      image:
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    },
    {
      name: "Performance",
      description: "Performance art and live artistic expressions",
      slug: "performance",
      image:
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop",
    },
    {
      name: "Video Art",
      description: "Video installations and digital video artworks",
      slug: "video-art",
      image:
        "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
    },
    {
      name: "Textile",
      description: "Fiber art, tapestries, and textile-based artworks",
      slug: "textile",
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400&h=300&fit=crop",
    },
    {
      name: "Ceramics",
      description: "Pottery, ceramic sculptures, and clay artworks",
      slug: "ceramics",
      image:
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop",
    },
  ];

  for (const categoryInfo of categoryData) {
    const category = await prisma.category.upsert({
      where: { slug: categoryInfo.slug },
      update: {
        image: categoryInfo.image,
        description: categoryInfo.description,
      },
      create: {
        name: categoryInfo.name,
        description: categoryInfo.description,
        slug: categoryInfo.slug,
        image: categoryInfo.image,
      },
    });
    categories.push(category);
    console.log(`✅ Created/Updated category: ${category.name}`);
  }

  // 5. Seed Artworks (12) with Categories
  console.log("\n📝 Seeding Artworks...");
  const artworks = [];
  const statuses: ArtworkStatus[] = ["PENDING", "APPROVED", "REJECTED", "SOLD"];
  for (let i = 0; i < 12; i++) {
    let artwork: any = null;
    try {
      artwork = await prisma.artwork.create({
        data: {
          title: `Artwork ${i + 1}`,
          artist: `Artist ${i + 1}`,
          support: "Canvas",
          state: "Excellent",
          yearOfArtwork: String(2020 + i),
          dimensions: { width: 50 + i * 10, height: 50 + i * 10, unit: "cm" },
          isFramed: i % 2 === 0,
          weight: `${1 + i}kg`,
          handDeliveryAccepted: true,
          origin: "Ethiopia",
          yearOfAcquisition: String(2023 + i),
          description: `Beautiful artwork ${i + 1} description`,
          desiredPrice: 1000 + i * 100,
          acceptPriceNegotiation: i % 2 === 0,
          accountHolder: `Account Holder ${i + 1}`,
          iban: `ET${String(i).padStart(22, "0")}`,
          bicCode: `ETBIC${i}`,
          acceptTermsOfSale: true,
          giveSalesMandate: true,
          photos: [`https://example.com/photo${i + 1}.jpg`],
          status: statuses[i % statuses.length],
          isApproved: statuses[i % statuses.length] === "APPROVED",
          userId: users[i].id,
        } as any,
      });
      artworks.push(artwork);
    } catch (error: any) {
      if (error.code === "P2002") {
        console.log(`⏭️  Artwork ${i + 1} already exists, skipping...`);
        // Try to find existing artwork
        const existing = await prisma.artwork.findFirst({
          where: {
            userId: users[i].id,
            title: `Artwork ${i + 1}`,
          },
        });
        if (existing) {
          artwork = existing;
          artworks.push(existing);
        } else {
          continue;
        }
      } else {
        throw error;
      }
    }

    // Assign 1-3 random categories to each artwork
    if (artwork) {
      const numCategories = Math.floor(Math.random() * 3) + 1;
      const selectedCategories = [];
      for (let j = 0; j < numCategories; j++) {
        const randomCategory =
          categories[Math.floor(Math.random() * categories.length)];
        if (!selectedCategories.find((c) => c.id === randomCategory.id)) {
          selectedCategories.push(randomCategory);
          try {
            await prisma.artworkOnCategory.upsert({
              where: {
                artworkId_categoryId: {
                  artworkId: artwork.id,
                  categoryId: randomCategory.id,
                },
              },
              update: {},
              create: {
                artworkId: artwork.id,
                categoryId: randomCategory.id,
              },
            } as any);
          } catch (error: any) {
            if (error.code !== "P2002") throw error;
          }
        }
      }
      console.log(
        `✅ Created artwork ${i + 1}: ${artwork.title} with ${selectedCategories.length} categories`
      );
    }
  }

  // 7. Seed Collections (12)
  console.log("\n📝 Seeding Collections...");
  const collections = [];
  for (let i = 0; i < 12; i++) {
    try {
      const collection = await prisma.collection.create({
        data: {
          name: `Collection ${i + 1}`,
          description: `Description for collection ${i + 1}`,
          visibility: i % 2 === 0 ? "PUBLIC" : "PRIVATE",
          createdBy: users[i].id,
        },
      });
      collections.push(collection);
      console.log(`✅ Created collection ${i + 1}`);
    } catch (error: any) {
      if (error.code === "P2002") {
        console.log(`⏭️  Collection ${i + 1} already exists, skipping...`);
        // Try to find existing collection
        const existing = await prisma.collection.findFirst({
          where: {
            createdBy: users[i].id,
            name: `Collection ${i + 1}`,
          },
        });
        if (existing) collections.push(existing);
      } else {
        throw error;
      }
    }
  }

  // 8. Seed CollectionOnArtwork (12)
  console.log("\n📝 Seeding CollectionOnArtwork...");
  for (let i = 0; i < 12; i++) {
    if (!collections[i] || !artworks[i]) continue;
    try {
      await prisma.collectionOnArtwork.upsert({
        where: {
          collectionId_artworkId: {
            collectionId: collections[i].id,
            artworkId: artworks[i].id,
          },
        },
        update: {},
        create: {
          collectionId: collections[i].id,
          artworkId: artworks[i].id,
        },
      });
      console.log(`✅ Created/Updated collection-artwork link ${i + 1}`);
    } catch (error: any) {
      if (error.code !== "P2002") throw error;
    }
  }

  // 9. Seed Comments (12)
  console.log("\n📝 Seeding Comments...");
  for (let i = 0; i < 12; i++) {
    if (!artworks[i]) continue;
    try {
      await prisma.comment.create({
        data: {
          artworkId: artworks[i].id,
          authorName: users[i].name,
          content: `This is a comment ${i + 1} on the artwork`,
        },
      });
      console.log(`✅ Created comment ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Comment ${i + 1} creation skipped (may already exist)`);
    }
  }

  // 10. Seed Disputes (12)
  console.log("\n📝 Seeding Disputes...");
  const disputeStatuses: DISPUTE_STATUS[] = [
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
  ];
  for (let i = 0; i < 12; i++) {
    const artwork = artworks[i];
    const user = users[i];
    const targetUser = users[(i + 1) % users.length];
    const disputeId = `dispute_${i}_seed`;
    await prisma.dispute.upsert({
      where: { id: disputeId },
      update: {},
      create: {
        id: disputeId,
        artworkId: artwork.id,
        raisedById: user.id,
        targetUserId: targetUser.id,
        status: disputeStatuses[i % disputeStatuses.length],
        reason: `Dispute reason ${i + 1}`,
        description: `Dispute description ${i + 1}`,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created/Updated dispute ${i + 1}`);
  }

  // 11. Seed FeaturedContent (12)
  console.log("\n📝 Seeding FeaturedContent...");
  for (let i = 0; i < 12; i++) {
    if (!artworks[i]) continue;
    try {
      await prisma.featuredContent.create({
        data: {
          label: `Featured ${i + 1}`,
          description: `Featured content description ${i + 1}`,
          artworkId: artworks[i].id,
        },
      });
      console.log(`✅ Created featured content ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Featured content ${i + 1} creation skipped`);
    }
  }

  // 12. Seed Interactions (12)
  console.log("\n📝 Seeding Interactions...");
  for (let i = 0; i < 12; i++) {
    if (!artworks[i]) continue;
    try {
      await prisma.interaction.create({
        data: {
          artworkId: artworks[i].id,
          userId: users[i].id,
          type: i % 2 === 0 ? "VIEW" : "SHARE",
          metadata: { source: "web" },
        },
      });
      console.log(`✅ Created interaction ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Interaction ${i + 1} creation skipped`);
    }
  }

  // 13. Seed Chats (12)
  console.log("\n📝 Seeding Chats...");
  const chats = [];
  const chatStatuses: CHAT_STATUS[] = ["OPEN", "CLOSED", "ARCHIVED"];
  for (let i = 0; i < 12; i++) {
    const client = users[i];
    const tasker = users[(i + 1) % users.length];
    const chatId = `chat_${i}_seed`;
    const chat = await prisma.chat.upsert({
      where: { id: chatId },
      update: {},
      create: {
        id: chatId,
        clientId: client.id,
        taskerId: tasker.id,
        status: chatStatuses[i % chatStatuses.length],
        updatedAt: new Date(),
      },
    });
    chats.push(chat);
    console.log(`✅ Created/Updated chat ${i + 1}`);
  }

  // 14. Seed Messages (12)
  console.log("\n📝 Seeding Messages...");
  const messageTypes: MESSAGE_TYPE[] = ["TEXT", "IMAGE", "SYSTEM"];
  const messageStatuses: MESSAGE_STATUS[] = ["SENT", "DELIVERED", "READ"];
  for (let i = 0; i < 12; i++) {
    const messageId = `message_${i}_seed`;
    await prisma.message.upsert({
      where: { id: messageId },
      update: {},
      create: {
        id: messageId,
        chatId: chats[i].id,
        senderId: users[i].id,
        receiverId: users[(i + 1) % users.length].id,
        content: `Message content ${i + 1}`,
        type: messageTypes[i % messageTypes.length],
        status: messageStatuses[i % messageStatuses.length],
      },
    });
    console.log(`✅ Created/Updated message ${i + 1}`);
  }

  // 15. Seed Notifications (12)
  console.log("\n📝 Seeding Notifications...");
  const notificationTypes: NOTIFICATION_TYPE[] = [
    "INFO",
    "WARNING",
    "ALERT",
    "MESSAGE",
    "SYSTEM",
  ];
  for (let i = 0; i < 12; i++) {
    const notificationId = `notification_${i}_seed`;
    await prisma.notification.upsert({
      where: { id: notificationId },
      update: {},
      create: {
        id: notificationId,
        userId: users[i].id,
        type: notificationTypes[i % notificationTypes.length],
        message: `Notification message ${i + 1}`,
        entityId: artworks[i].id,
      },
    });
    console.log(`✅ Created/Updated notification ${i + 1}`);
  }

  // 16. Seed PaymentGateways (12)
  console.log("\n📝 Seeding PaymentGateways...");
  const gateways = [];
  const gatewayNames = [
    "Chapa",
    "PayPal",
    "Stripe",
    "M-Pesa",
    "Bank Transfer",
    "Credit Card",
    "Debit Card",
    "Mobile Money",
    "Cryptocurrency",
    "Apple Pay",
    "Google Pay",
    "Venmo",
  ];
  for (let i = 0; i < 12; i++) {
    const gatewayId = gatewayNames[i].toLowerCase().replace(/\s+/g, "_");
    const gateway = await prisma.paymentGateway.upsert({
      where: { id: gatewayId },
      update: {
        name: gatewayNames[i],
        enabled: i % 2 === 0,
        updatedAt: new Date(),
      },
      create: {
        id: gatewayId,
        name: gatewayNames[i],
        enabled: i % 2 === 0,
        updatedAt: new Date(),
      },
    });
    gateways.push(gateway);
    console.log(`✅ Created/Updated payment gateway ${i + 1}: ${gateway.name}`);
  }

  // 17. Seed Orders (12)
  console.log("\n📝 Seeding Orders...");
  const orders = [];
  const orderStatuses: OrderStatus[] = [
    "PENDING",
    "PAID",
    "CANCELLED",
    "REFUNDED",
  ];
  for (let i = 0; i < 12; i++) {
    try {
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
    } catch (error: any) {
      console.log(`⏭️  Order ${i + 1} creation skipped`);
      // Create a placeholder to maintain array length
      orders.push(null as any);
    }
  }

  // 18. Seed OrderItems (12)
  console.log("\n📝 Seeding OrderItems...");
  for (let i = 0; i < 12; i++) {
    if (!orders[i] || !artworks[i]) continue;
    try {
      await prisma.orderItem.create({
        data: {
          orderId: orders[i].id,
          artworkId: artworks[i].id,
          quantity: 1,
          price: new Decimal(500 + i * 50),
        },
      });
      console.log(`✅ Created order item ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Order item ${i + 1} creation skipped`);
    }
  }

  // 19. Seed Transactions (12)
  console.log("\n📝 Seeding Transactions...");
  const transactionStatuses: PaymentStatus[] = [
    "INITIATED",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
  ];
  for (let i = 0; i < 12; i++) {
    if (!orders[i]) continue;
    try {
      await prisma.transaction.upsert({
        where: { orderId: orders[i].id },
        update: {},
        create: {
          orderId: orders[i].id,
          paymentGatewayId: gateways[i % gateways.length].id,
          status: transactionStatuses[i % transactionStatuses.length],
          amount: new Decimal(500 + i * 50),
          metadata: { source: "web", paymentMethod: "card" },
        },
      });
      console.log(`✅ Created/Updated transaction ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Transaction ${i + 1} creation skipped`);
    }
  }

  // 20. Seed Payments (12)
  console.log("\n📝 Seeding Payments...");
  const paymentStatuses: PAYMENT_STATUS[] = [
    "PENDING",
    "COMPLETED",
    "FAILED",
    "REFUNDED",
  ];
  for (let i = 0; i < 12; i++) {
    const paymentId = `payment_${i}_seed`;
    await prisma.payment.upsert({
      where: { id: paymentId },
      update: {},
      create: {
        id: paymentId,
        bookingId: `booking_${i}`,
        amount: 500 + i * 50,
        method: gateways[i % gateways.length].name,
        status: paymentStatuses[i % paymentStatuses.length],
      },
    });
    console.log(`✅ Created/Updated payment ${i + 1}`);
  }

  // 21. Seed Receipts (12)
  console.log("\n📝 Seeding Receipts...");
  for (let i = 0; i < 12; i++) {
    if (!orders[i]) continue;
    try {
      await prisma.receipt.upsert({
        where: { orderId: orders[i].id },
        update: {},
        create: {
          orderId: orders[i].id,
          pdfUrl: `https://example.com/receipts/receipt_${i + 1}.pdf`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`✅ Created/Updated receipt ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Receipt ${i + 1} creation skipped`);
    }
  }

  // 22. Seed Reports (12)
  console.log("\n📝 Seeding Reports...");
  const reportReasons: ReportReason[] = [
    "SPAM",
    "COPYRIGHT",
    "ABUSE",
    "INAPPROPRIATE",
    "OTHER",
  ];
  const reportStatuses: ReportStatus[] = [
    "OPEN",
    "UNDER_REVIEW",
    "ACTIONED",
    "DISMISSED",
  ];
  for (let i = 0; i < 12; i++) {
    if (!artworks[i]) continue;
    const artwork = artworks[i];
    const user = users[i];
    const reportId = `report_${i}_seed`;
    try {
      await prisma.report.upsert({
        where: { id: reportId },
        update: {},
        create: {
          id: reportId,
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
      console.log(`✅ Created/Updated report ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Report ${i + 1} creation skipped`);
    }
  }

  // 23. Seed Reviews (12)
  console.log("\n📝 Seeding Reviews...");
  for (let i = 0; i < 12; i++) {
    const artwork = artworks[i];
    const user = users[i];
    const reviewId = `review_${i}_seed`;
    await prisma.review.upsert({
      where: { id: reviewId },
      update: {},
      create: {
        id: reviewId,
        artworkId: artwork.id,
        userId: user.id,
        rating: (i % 5) + 1,
        comment: `Review comment ${i + 1}`,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Created/Updated review ${i + 1}`);
  }

  // 24. Seed Withdrawals (12)
  console.log("\n📝 Seeding Withdrawals...");
  const withdrawalStatuses: PaymentStatus[] = [
    "INITIATED",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
  ];
  for (let i = 0; i < 12; i++) {
    try {
      await prisma.withdrawal.create({
        data: {
          userId: users[i].id,
          payoutAccount: `ET${String(i).padStart(22, "0")}`,
          amount: new Decimal(100 + i * 50),
          status: withdrawalStatuses[i % withdrawalStatuses.length],
        },
      });
      console.log(`✅ Created withdrawal ${i + 1}`);
    } catch (error: any) {
      console.log(`⏭️  Withdrawal ${i + 1} creation skipped`);
    }
  }

  // 25. Seed CartItems (12)
  console.log("\n📝 Seeding CartItems...");
  for (let i = 0; i < 12; i++) {
    await prisma.cartItem.upsert({
      where: {
        userId_artworkId: {
          userId: users[i].id,
          artworkId: artworks[i].id,
        },
      },
      update: {
        quantity: 1 + (i % 3),
      },
      create: {
        userId: users[i].id,
        artworkId: artworks[i].id,
        quantity: 1 + (i % 3),
      },
    });
    console.log(`✅ Created/Updated cart item ${i + 1}`);
  }

  // 26. Seed Favorites (12)
  console.log("\n📝 Seeding Favorites...");
  for (let i = 0; i < 12; i++) {
    await prisma.favorite.upsert({
      where: {
        userId_artworkId: {
          userId: users[i].id,
          artworkId: artworks[i].id,
        },
      },
      update: {},
      create: {
        userId: users[i].id,
        artworkId: artworks[i].id,
      },
    });
    console.log(`✅ Created/Updated favorite ${i + 1}`);
  }

  // 27. Seed Policies (12)
  console.log("\n📝 Seeding Policies...");
  const policyTypes = [
    "TERMS",
    "PRIVACY",
    "REFUND",
    "SHIPPING",
    "RETURNS",
    "COPYRIGHT",
    "COMMUNITY",
    "SELLER",
    "BUYER",
    "PAYMENT",
    "ACCOUNT",
    "CONTENT",
  ];
  for (let i = 0; i < 12; i++) {
    // Check if policy exists by type
    const existing = await prisma.policy.findFirst({
      where: { type: policyTypes[i] },
    });

    if (existing) {
      await prisma.policy.update({
        where: { id: existing.id },
        data: {
          content: `Policy content for ${policyTypes[i]}`,
          version: `1.${i}`,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Updated policy ${i + 1}: ${policyTypes[i]}`);
    } else {
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
  }

  console.log("\n✅ Seeding completed! All tables seeded with 12 rows each.");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
