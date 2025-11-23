import { PrismaClient, ArtworkStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Artwork data with actual images from public folder
const artworkData = [
  {
    title: "City of Boxes - Auroraville",
    artist: "WERNER ROELANDT",
    support: "Photography",
    state: "Excellent",
    yearOfArtwork: "2024",
    dimensions: { width: 60, height: 90, depth: 0.2 },
    isFramed: false,
    weight: "0.5kg",
    handDeliveryAccepted: true,
    origin: "Belgium",
    yearOfAcquisition: "2024",
    description: "A stunning photographic work capturing the essence of urban architecture through geometric forms and light play.",
    desiredPrice: 1300.00,
    acceptPriceNegotiation: true,
    accountHolder: "Werner Roelandt",
    iban: "BE68539007547034",
    bicCode: "GKCCBEBB",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-1.jpg"],
    categoryNames: ["Photography"],
  },
  {
    title: "Water lilies on Lake Bled",
    artist: "OXYPOINT",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 30, height: 30, depth: 0.3 },
    isFramed: true,
    weight: "1.2kg",
    handDeliveryAccepted: true,
    origin: "Slovenia",
    yearOfAcquisition: "2025",
    description: "A vibrant painting inspired by Monet's water lilies, capturing the serene beauty of Lake Bled.",
    desiredPrice: 390.00,
    acceptPriceNegotiation: false,
    accountHolder: "OXYPOINT Gallery",
    iban: "SI56011000001234567",
    bicCode: "BAKLSI22",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-2.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Kaws is in LOVE",
    artist: "PATRICK CORNÉE",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 30, height: 30, depth: 3 },
    isFramed: false,
    weight: "2.5kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2025",
    description: "A contemporary pop art piece inspired by KAWS, exploring themes of love and connection in modern culture.",
    desiredPrice: 1200.00,
    acceptPriceNegotiation: true,
    accountHolder: "Patrick Cornée",
    iban: "FR7630006000011234567890189",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-3.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Le vieux pot de peinture",
    artist: "YANNICK BOUILLAULT",
    support: "Sculpture",
    state: "Very Good",
    yearOfArtwork: "2024",
    dimensions: { width: 30, height: 14, depth: 16 },
    isFramed: false,
    weight: "3.2kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2024",
    description: "A unique sculptural piece transforming an old paint pot into a work of art, celebrating the beauty of everyday objects.",
    desiredPrice: 380.00,
    acceptPriceNegotiation: true,
    accountHolder: "Yannick Bouillault",
    iban: "FR7630006000011234567890190",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-4.jpg"],
    categoryNames: ["Sculpture"],
  },
  {
    title: "Abstract Dreams",
    artist: "MARIE DUBOIS",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2024",
    dimensions: { width: 40, height: 50, depth: 2 },
    isFramed: true,
    weight: "1.8kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2024",
    description: "An abstract expressionist painting that explores the boundaries between dreams and reality through bold colors and fluid forms.",
    desiredPrice: 750.00,
    acceptPriceNegotiation: true,
    accountHolder: "Marie Dubois",
    iban: "FR7630006000011234567890191",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-5.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "LA Dance",
    artist: "PYB",
    support: "Sculpture",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 20, height: 30, depth: 6 },
    isFramed: false,
    weight: "2.1kg",
    handDeliveryAccepted: true,
    origin: "United States",
    yearOfAcquisition: "2025",
    description: "A dynamic sculpture capturing the energy and movement of dance, inspired by the vibrant art scene of Los Angeles.",
    desiredPrice: 260.00,
    acceptPriceNegotiation: false,
    accountHolder: "TAAR galerie",
    iban: "US64SVBKUS6S3300958879",
    bicCode: "SVBKUS6S",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-6.jpg"],
    categoryNames: ["Sculpture"],
  },
  {
    title: "Respiration intérieure",
    artist: "CHROMA (FRÉDÉRIC FONT)",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 60, height: 60, depth: 4 },
    isFramed: true,
    weight: "3.5kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2025",
    description: "A meditative painting exploring inner breath and spiritual connection through harmonious color relationships.",
    desiredPrice: 2000.00,
    acceptPriceNegotiation: true,
    accountHolder: "Frédéric Font (Chroma)",
    iban: "FR7630006000011234567890192",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/black-and-white-artistic-drawing-modern-art.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Rebirth",
    artist: "HELENA MONNIELLO",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 80, height: 80, depth: 2 },
    isFramed: true,
    weight: "4.2kg",
    handDeliveryAccepted: true,
    origin: "Italy",
    yearOfAcquisition: "2025",
    description: "A powerful large-format painting symbolizing renewal and transformation, using rich textures and vibrant colors.",
    desiredPrice: 1200.00,
    acceptPriceNegotiation: true,
    accountHolder: "Helena Monniello",
    iban: "IT60X0542811101000000123456",
    bicCode: "BPBAITRR",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-1.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Organic Silmolde",
    artist: "YANNICK BOUILLAULT",
    support: "Sculpture",
    state: "Very Good",
    yearOfArtwork: "2023",
    dimensions: { width: 68, height: 9, depth: 25 },
    isFramed: false,
    weight: "5.8kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2023",
    description: "An organic sculptural form that explores the relationship between nature and industrial design.",
    desiredPrice: 1200.00,
    acceptPriceNegotiation: true,
    accountHolder: "Yannick Bouillault",
    iban: "FR7630006000011234567890193",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-2.jpg"],
    categoryNames: ["Sculpture"],
  },
  {
    title: "Snow Clue",
    artist: "NOBLESS",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2024",
    dimensions: { width: 73, height: 46, depth: 1.5 },
    isFramed: true,
    weight: "2.3kg",
    handDeliveryAccepted: true,
    origin: "United States",
    yearOfAcquisition: "2024",
    description: "A minimalist painting capturing the quiet beauty of winter landscapes through subtle color gradations.",
    desiredPrice: 1900.00,
    acceptPriceNegotiation: false,
    accountHolder: "Academy of arts",
    iban: "US64SVBKUS6S3300958880",
    bicCode: "SVBKUS6S",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-3.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Turquoise Flow",
    artist: "OXYPOINT",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 40, height: 30, depth: 2 },
    isFramed: true,
    weight: "1.5kg",
    handDeliveryAccepted: true,
    origin: "Slovenia",
    yearOfAcquisition: "2025",
    description: "A fluid abstract painting featuring turquoise tones that evoke the movement of water and sky.",
    desiredPrice: 410.00,
    acceptPriceNegotiation: true,
    accountHolder: "Oxypoint",
    iban: "SI56011000001234568",
    bicCode: "BAKLSI22",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-4.jpg"],
    categoryNames: ["Painting"],
  },
  {
    title: "Famille (n° 376)",
    artist: "DIDIER FOURNIER",
    support: "Sculpture",
    state: "Excellent",
    yearOfArtwork: "2025",
    dimensions: { width: 25, height: 15, depth: 8 },
    isFramed: false,
    weight: "1.8kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2025",
    description: "A delicate sculptural representation of family bonds, part of an ongoing series exploring human relationships.",
    desiredPrice: 2200.00,
    acceptPriceNegotiation: true,
    accountHolder: "Didier Fournier",
    iban: "FR7630006000011234567890194",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-5.jpg"],
    categoryNames: ["Sculpture"],
  },
  {
    title: "Ocean Dreams",
    artist: "MARINE ARTIST",
    support: "Painting",
    state: "Excellent",
    yearOfArtwork: "2024",
    dimensions: { width: 50, height: 40, depth: 2 },
    isFramed: true,
    weight: "2.0kg",
    handDeliveryAccepted: true,
    origin: "France",
    yearOfAcquisition: "2024",
    description: "A serene seascape painting that captures the tranquility and power of ocean waves at sunset.",
    desiredPrice: 850.00,
    acceptPriceNegotiation: true,
    accountHolder: "Marine Gallery",
    iban: "FR7630006000011234567890195",
    bicCode: "BNPAFRPP",
    acceptTermsOfSale: true,
    giveSalesMandate: true,
    photos: ["/artwork-6.jpg"],
    categoryNames: ["Painting"],
  },
];

// User/Artist data
const userData = [
  { name: "Werner Roelandt", email: "werner.roelandt@example.com" },
  { name: "OXYPOINT", email: "oxypoint@example.com" },
  { name: "Patrick Cornée", email: "patrick.cornee@example.com" },
  { name: "Yannick Bouillault", email: "yannick.bouillault@example.com" },
  { name: "Marie Dubois", email: "marie.dubois@example.com" },
  { name: "PYB", email: "pyb@example.com" },
  { name: "Frédéric Font (Chroma)", email: "frederic.font@example.com" },
  { name: "Helena Monniello", email: "helena.monniello@example.com" },
  { name: "NOBLESS", email: "nobless@example.com" },
  { name: "Didier Fournier", email: "didier.fournier@example.com" },
  { name: "Marine Gallery", email: "marine.gallery@example.com" },
];

async function main() {
  console.log('🌱 Seeding database for landing page...\n');

  // 1. Create or get Categories
  console.log('📝 Seeding Categories...');
  const categoryNames = ['Painting', 'Sculpture', 'Photography', 'Digital Art', 'Drawing', 'Print', 'Mixed Media'];
  const categories = [];
  
  for (const categoryName of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: {
        name: categoryName,
        description: `Artworks in the ${categoryName} category`,
        slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
      },
    });
    categories.push(category);
    console.log(`✅ Category: ${category.name}`);
  }

  // 2. Create or get Users/Artists
  console.log('\n📝 Seeding Users/Artists...');
  const users = [];
  
  for (const userInfo of userData) {
    const user = await prisma.user.upsert({
      where: { email: userInfo.email },
      update: {
        name: userInfo.name,
      },
      create: {
        name: userInfo.name,
        email: userInfo.email,
        role: 'USER',
        emailVerified: true,
        score: Math.floor(Math.random() * 50) + 50, // 50-100
        banned: false,
        updatedAt: new Date(),
      },
    });
    users.push(user);
    console.log(`✅ User: ${user.name} (${user.email})`);
  }

  // 3. Create Artworks
  console.log('\n📝 Seeding Artworks...');
  const createdArtworks = [];
  
  for (let i = 0; i < artworkData.length; i++) {
    const artworkInfo = artworkData[i];
    const user = users[i % users.length]; // Cycle through users
    
    // Find categories for this artwork
    const artworkCategories = artworkInfo.categoryNames.map(catName => 
      categories.find(c => c.name === catName)
    ).filter(Boolean);

    const artwork = await prisma.artwork.create({
      data: {
        title: artworkInfo.title,
        artist: artworkInfo.artist,
        support: artworkInfo.support,
        state: artworkInfo.state,
        yearOfArtwork: artworkInfo.yearOfArtwork,
        dimensions: artworkInfo.dimensions as any,
        isFramed: artworkInfo.isFramed,
        weight: artworkInfo.weight,
        handDeliveryAccepted: artworkInfo.handDeliveryAccepted,
        origin: artworkInfo.origin,
        yearOfAcquisition: artworkInfo.yearOfAcquisition,
        description: artworkInfo.description,
        desiredPrice: artworkInfo.desiredPrice,
        acceptPriceNegotiation: artworkInfo.acceptPriceNegotiation,
        accountHolder: artworkInfo.accountHolder,
        iban: artworkInfo.iban,
        bicCode: artworkInfo.bicCode,
        acceptTermsOfSale: artworkInfo.acceptTermsOfSale,
        giveSalesMandate: artworkInfo.giveSalesMandate,
        photos: artworkInfo.photos,
        status: 'APPROVED' as ArtworkStatus,
        isApproved: true,
        userId: user.id,
        categories: {
          create: artworkCategories.map(cat => ({
            categoryId: cat!.id,
          })),
        },
      },
    });
    
    createdArtworks.push(artwork);
    console.log(`✅ Artwork: ${artwork.title} by ${artwork.artist} (€${artwork.desiredPrice})`);
  }

  console.log(`\n✅ Seeding completed!`);
  console.log(`   - ${categories.length} categories`);
  console.log(`   - ${users.length} users/artists`);
  console.log(`   - ${createdArtworks.length} approved artworks`);
  console.log(`\n🎨 Your landing page is now ready with real data!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

