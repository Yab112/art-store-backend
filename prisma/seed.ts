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

// Seeding requires a direct (non-pooled) connection.
// PgBouncer (pooler) drops idle connections during long-running seed operations → P1017.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});

// S3 Base URL (kept for reference — migrated to Cloudinary)
// const S3_BASE_URL = "https://fam-art-gallery-media.s3.eu-north-1.amazonaws.com/images";

// Use picsum.photos as seed image source — always-on, no account needed.
// Format: https://picsum.photos/seed/<seed-string>/800/600
const PICSUM_SEEDS = [
  "art1",
  "art2",
  "art3",
  "art4",
  "art5",
  "gallery1",
  "gallery2",
  "gallery3",
  "gallery4",
  "gallery5",
  "paint1",
  "paint2",
  "paint3",
  "paint4",
  "paint5",
  "photo1",
  "photo2",
  "photo3",
  "photo4",
  "photo5",
];

// Helper to get a deterministic picsum image URL
const getImageUrl = (seed: string) =>
  `https://picsum.photos/seed/${seed}/800/600`;

// Helper to get random picsum image
const getRandomImage = () =>
  getImageUrl(PICSUM_SEEDS[Math.floor(Math.random() * PICSUM_SEEDS.length)]);

async function main() {
  console.log("🌱 Seeding database with comprehensive data...");

  // 0. Seed Talent Types
  console.log("\n📝 Seeding Talent Types...");
  const talentTypes = [];
  const talentTypeData = [
    {
      name: "Painter",
      slug: "painter",
      description: "Traditional and digital painters",
      image: "talent-types/painter.png",
      sortOrder: 1,
    },
    {
      name: "Photographer",
      slug: "photographer",
      description: "Professional and artistic photographers",
      image: "talent-types/photographer.png",
      sortOrder: 2,
    },
    {
      name: "Digital Artist",
      slug: "digital-artist",
      description: "Digital art creators and illustrators",
      image: "talent-types/digital-artist.png",
      sortOrder: 3,
    },
    {
      name: "Sculptor",
      slug: "sculptor",
      description: "Sculpture artists working with various materials",
      image: "talent-types/sculptor.png",
      sortOrder: 4,
    },
    {
      name: "Calligrapher",
      slug: "calligrapher",
      description: "Calligraphy and lettering artists",
      image: "talent-types/calligrapher.png",
      sortOrder: 5,
    },
    {
      name: "Tattoo Artist",
      slug: "tattoo-artist",
      description: "Professional tattoo artists",
      image: "talent-types/tattoo-artist.png",
      sortOrder: 6,
    },
    {
      name: "Fashion Designer",
      slug: "fashion-designer",
      description: "Fashion and textile designers",
      image: "talent-types/fashion-designer.png",
      sortOrder: 7,
    },
    {
      name: "Mixed Media",
      slug: "mixed-media",
      description: "Artists working with multiple mediums",
      image: "talent-types/mixed-media.png",
      sortOrder: 8,
    },
    {
      name: "Illustrator",
      slug: "illustrator",
      description: "Illustration and graphic design artists",
      image: "talent-types/illustrator.png",
      sortOrder: 9,
    },
    {
      name: "Ceramicist",
      slug: "ceramicist",
      description: "Pottery and ceramic artists",
      image: "talent-types/ceramicist.png",
      sortOrder: 10,
    },
    {
      name: "Street Artist",
      slug: "street-artist",
      description: "Graffiti and street art creators",
      image: "talent-types/street-artist.png",
      sortOrder: 11,
    },
    {
      name: "Other",
      slug: "other",
      description: "Other artistic talents",
      image: "talent-types/other.png",
      sortOrder: 12,
    },
  ];

  for (const talentTypeInfo of talentTypeData) {
    const talentType = await prisma.talentType.upsert({
      where: { slug: talentTypeInfo.slug },
      update: {
        name: talentTypeInfo.name,
        description: talentTypeInfo.description,
        image: talentTypeInfo.image,
        sortOrder: talentTypeInfo.sortOrder,
      },
      create: {
        name: talentTypeInfo.name,
        slug: talentTypeInfo.slug,
        description: talentTypeInfo.description,
        image: talentTypeInfo.image,
        sortOrder: talentTypeInfo.sortOrder,
      },
    });
    talentTypes.push(talentType);
    console.log(`✅ Created/Updated talent type: ${talentType.name}`);
  }

  // 1. Seed Categories
  console.log("\n📝 Seeding Categories...");
  const categories = [];
  const categoryData = [
    {
      name: "Painting",
      description: "Oil, acrylic, watercolor, and mixed media paintings",
      slug: "painting",
      image: getRandomImage(),
    },
    {
      name: "Sculpture",
      description: "Three-dimensional artworks in various materials",
      slug: "sculpture",
      image: getRandomImage(),
    },
    {
      name: "Photography",
      description: "Fine art and documentary photography",
      slug: "photography",
      image: getRandomImage(),
    },
    {
      name: "Digital Art",
      description: "Digital illustrations, NFTs, and computer-generated art",
      slug: "digital-art",
      image: getRandomImage(),
    },
    {
      name: "Drawing",
      description: "Pencil, charcoal, ink, and pastel drawings",
      slug: "drawing",
      image: getRandomImage(),
    },
    {
      name: "Print",
      description: "Lithographs, screen prints, and etchings",
      slug: "print",
      image: getRandomImage(),
    },
    {
      name: "Mixed Media",
      description: "Artworks combining multiple materials and techniques",
      slug: "mixed-media",
      image: getRandomImage(),
    },
    {
      name: "Installation",
      description: "Large-scale immersive art installations",
      slug: "installation",
      image: getRandomImage(),
    },
    {
      name: "Performance",
      description: "Performance art and live artistic expressions",
      slug: "performance",
      image: getRandomImage(),
    },
    {
      name: "Video Art",
      description: "Video installations and digital video artworks",
      slug: "video-art",
      image: getRandomImage(),
    },
    {
      name: "Textile",
      description: "Fiber art, tapestries, and textile-based artworks",
      slug: "textile",
      image: getRandomImage(),
    },
    {
      name: "Ceramics",
      description: "Pottery, ceramic sculptures, and clay artworks",
      slug: "ceramics",
      image: getRandomImage(),
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

  // 2. Seed Users (40 artists - enough for all talent types and similar artists)
  console.log("\n📝 Seeding Users (Artists)...");
  const users = [];
  const artistNames = [
    "Alexandra Monet",
    "Benjamin Van Gogh",
    "Charlotte Picasso",
    "David Da Vinci",
    "Emma Renoir",
    "Felix Matisse",
    "Grace Kahlo",
    "Henry Dali",
    "Isabella Klimt",
    "James Warhol",
    "Katherine O'Keeffe",
    "Lucas Pollock",
    "Maya Basquiat",
    "Noah Hockney",
    "Olivia Banksy",
    "Paul Cézanne",
    "Quinn Degas",
    "Rachel Vermeer",
    "Samuel Turner",
    "Tara Rembrandt",
    "Uma Goya",
    "Victor Velázquez",
    "Wendy Botticelli",
    "Xavier Caravaggio",
    "Yara Michelangelo",
    "Zoe Raphael",
    "Aaron Kandinsky",
    "Bella Mondrian",
    "Caleb Rothko",
    "Diana Hopper",
    "Ethan Wyeth",
    "Fiona Rockwell",
    "Gavin Lichtenstein",
    "Hannah Haring",
    "Ian Koons",
    "Jade Murakami",
    "Kai Kusama",
    "Luna Yayoi",
    "Max Richter",
    "Nina Richter",
  ];

  // Bio templates for variety
  const bioTemplates = [
    (name: string, years: number) =>
      `${name} is a passionate artist with over ${years} years of experience in creating stunning visual art. Specializing in contemporary and traditional techniques, ${name} brings a unique perspective to every piece.`,
    (name: string, years: number) =>
      `With ${years} years of artistic practice, ${name} has developed a distinctive style that blends modern innovation with classical foundations. Their work has been featured in numerous exhibitions and private collections.`,
    (name: string, years: number) =>
      `${name} is an accomplished artist known for their innovative approach to art. Over ${years} years, they have mastered various mediums and continue to push creative boundaries.`,
    (name: string, years: number) =>
      `A dedicated artist with ${years} years of experience, ${name} creates art that speaks to the soul. Their work reflects deep understanding of color, form, and emotional expression.`,
    (name: string, years: number) =>
      `${name} combines technical excellence with creative vision. With ${years} years in the art world, they have established themselves as a respected creator in their field.`,
  ];

  for (let i = 0; i < 40; i++) {
    const artistName = artistNames[i] || `Artist ${i + 1}`;
    const years = 10 + i;
    const bioTemplate = bioTemplates[i % bioTemplates.length];
    const bio = bioTemplate(artistName, years);
    const location = [
      "France",
      "Italy",
      "Spain",
      "USA",
      "UK",
      "Germany",
      "Japan",
      "Ethiopia",
    ][i % 8];
    const website = `https://${artistName.toLowerCase().replace(/\s+/g, "") || `artist${i + 1}`}.com`;

    const user = await prisma.user.upsert({
      where: { email: `artist${i + 1}@example.com` },
      update: {
        name: artistName,
        image: getRandomImage(),
        location: location,
        bio: bio,
        website: website,
        profileViews: Math.floor(Math.random() * 1000),
        heatScore: Math.random() * 100,
      },
      create: {
        name: artistName,
        email: `artist${i + 1}@example.com`,
        role: i < 2 ? "ADMIN" : "USER",
        emailVerified: true,
        image: getRandomImage(),
        coverImage: getRandomImage(),
        location: location,
        bio: bio,
        website: website,
        score: Math.random() * 100,
        profileViews: Math.floor(Math.random() * 1000),
        heatScore: Math.random() * 100,
        banned: false,
        updatedAt: new Date(),
      },
    });
    users.push(user);
    console.log(`✅ Created/Updated artist ${i + 1}: ${user.name}`);
  }

  // 3. Assign Talent Types to Users (Create similar artists by assigning same talent types)
  console.log("\n📝 Assigning Talent Types to Artists...");
  // Group artists by talent type - some will share talent types for similar artists feature
  const talentTypeAssignments: { [key: string]: number[] } = {
    painter: [0, 1, 2, 3, 4], // 5 painters (similar artists)
    photographer: [5, 6, 7, 8, 9], // 5 photographers (similar artists)
    "digital-artist": [10, 11, 12, 13, 14], // 5 digital artists (similar artists)
    sculptor: [15, 16, 17, 18, 19], // 5 sculptors (similar artists)
    calligrapher: [20, 21], // 2 calligraphers
    "tattoo-artist": [22, 23], // 2 tattoo artists
    "fashion-designer": [24, 25], // 2 fashion designers
    "mixed-media": [26, 27, 28], // 3 mixed media artists
    illustrator: [29, 30, 31], // 3 illustrators
    ceramicist: [32, 33], // 2 ceramicists
    "street-artist": [34, 35], // 2 street artists
    other: [36, 37, 38, 39], // 4 other
  };

  for (const [talentSlug, userIndices] of Object.entries(
    talentTypeAssignments,
  )) {
    const talentType = talentTypes.find((tt) => tt.slug === talentSlug);
    if (!talentType) continue;

    for (const userIndex of userIndices) {
      if (users[userIndex]) {
        try {
          await prisma.userOnTalentType.upsert({
            where: {
              userId_talentTypeId: {
                userId: users[userIndex].id,
                talentTypeId: talentType.id,
              },
            },
            update: {},
            create: {
              userId: users[userIndex].id,
              talentTypeId: talentType.id,
            },
          });
          console.log(
            `✅ Assigned ${talentType.name} to ${users[userIndex].name}`,
          );
        } catch (error: any) {
          if (error.code !== "P2002") throw error;
        }
      }
    }
  }

  // 4. Seed Artworks (At least 5 per category = 60+ artworks)
  console.log("\n📝 Seeding Artworks (5+ per category)...");
  const artworks = [];
  const artworkTitles = [
    "Sunset Over Mountains",
    "Urban Dreams",
    "Ocean Waves",
    "Forest Path",
    "City Lights",
    "Abstract Harmony",
    "Colorful Chaos",
    "Serene Landscape",
    "Modern Architecture",
    "Vintage Portrait",
    "Nature's Beauty",
    "Digital Dreams",
    "Classical Elegance",
    "Contemporary Vision",
    "Minimalist Design",
    "Bold Expression",
    "Subtle Nuances",
    "Dynamic Movement",
    "Still Life",
    "Portrait Study",
    "Abstract Forms",
    "Geometric Patterns",
    "Organic Shapes",
    "Textured Surface",
    "Light and Shadow",
    "Emotional Journey",
    "Cultural Heritage",
    "Future Vision",
    "Past Memories",
    "Present Moment",
    "Inner Peace",
    "Outer Chaos",
    "Balance",
    "Contrast",
    "Harmony",
    "Freedom",
    "Confinement",
    "Hope",
    "Despair",
    "Love",
    "War",
    "Peace",
    "Life",
    "Death",
    "Birth",
    "Growth",
    "Decay",
    "Creation",
    "Destruction",
    "Transformation",
    "Journey",
    "Destination",
    "Beginning",
    "End",
    "Continuation",
    "Unity",
    "Division",
    "Connection",
    "Isolation",
    "Community",
  ];

  let artworkIndex = 0;
  // Create at least 5 artworks per category
  for (const category of categories) {
    for (let i = 0; i < 5; i++) {
      const userIndex = artworkIndex % users.length;
      const user = users[userIndex];
      const title =
        artworkTitles[artworkIndex % artworkTitles.length] ||
        `Artwork ${artworkIndex + 1}`;

      try {
        const artwork = await prisma.artwork.create({
          data: {
            title: `${title} - ${category.name}`,
            artist: user.name,
            support: ["Canvas", "Paper", "Wood", "Metal", "Fabric"][i % 5],
            state: ["Excellent", "Good", "Very Good", "Mint", "Fine"][i % 5],
            yearOfArtwork: String(2015 + (artworkIndex % 10)),
            dimensions: {
              width: 30 + (artworkIndex % 50) * 2,
              height: 40 + (artworkIndex % 50) * 2,
              depth: artworkIndex % 2 === 0 ? 2 : undefined,
              unit: "cm",
            },
            isFramed: artworkIndex % 2 === 0,
            weight: `${0.5 + (artworkIndex % 5) * 0.3}kg`,
            handDeliveryAccepted: true,
            origin: user.location || "Unknown",
            yearOfAcquisition: String(2020 + (artworkIndex % 5)),
            description: `A beautiful ${category.name.toLowerCase()} artwork by ${user.name}. This piece represents the artist's unique style and vision.`,
            desiredPrice: 500 + (artworkIndex % 20) * 250,
            acceptPriceNegotiation: artworkIndex % 3 !== 0,
            accountHolder: user.name,
            iban: `ET${String(artworkIndex).padStart(22, "0")}`,
            bicCode: `ETBIC${artworkIndex}`,
            acceptTermsOfSale: true,
            giveSalesMandate: true,
            photos: [getRandomImage(), getRandomImage()], // Multiple photos
            status: "APPROVED",
            isApproved: true,
            userId: user.id,
          } as any,
        });
        artworks.push(artwork);
        artworkIndex++;
        console.log(
          `✅ Created artwork: ${artwork.title} (Category: ${category.name})`,
        );
      } catch (error: any) {
        if (error.code === "P2002") {
          console.log(
            `⏭️  Artwork ${artworkIndex + 1} already exists, skipping...`,
          );
          artworkIndex++;
        } else {
          throw error;
        }
      }
    }
  }

  // 5. Assign Categories to Artworks (Create similar artworks by assigning same categories)
  console.log("\n📝 Assigning Categories to Artworks...");
  // Group artworks by category - some will share categories for similar artworks feature
  let categoryArtworkIndex = 0;
  for (const category of categories) {
    // Assign this category to 5 artworks (the ones we just created for this category)
    for (let i = 0; i < 5; i++) {
      const artwork = artworks[categoryArtworkIndex];
      if (artwork) {
        try {
          await prisma.artworkOnCategory.upsert({
            where: {
              artworkId_categoryId: {
                artworkId: artwork.id,
                categoryId: category.id,
              },
            },
            update: {},
            create: {
              artworkId: artwork.id,
              categoryId: category.id,
            },
          });
          // Also assign 1-2 additional random categories to some artworks for variety
          if (i < 2 && Math.random() > 0.5) {
            const randomCategory =
              categories[Math.floor(Math.random() * categories.length)];
            if (randomCategory.id !== category.id) {
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
                });
              } catch (error: any) {
                if (error.code !== "P2002") throw error;
              }
            }
          }
        } catch (error: any) {
          if (error.code !== "P2002") throw error;
        }
      }
      categoryArtworkIndex++;
    }
    console.log(`✅ Assigned ${category.name} to 5 artworks`);
  }

  // 6. Seed Collections (Create collections for some artists)
  console.log("\n📝 Seeding Collections...");
  const collections = [];
  const collectionNames = [
    "Nature Collection",
    "Urban Life",
    "Abstract Expressions",
    "Portrait Series",
    "Landscape Studies",
    "Modern Art",
    "Classical Works",
    "Contemporary Pieces",
    "Digital Creations",
    "Mixed Media Works",
    "Sculpture Collection",
    "Photography Series",
  ];

  // Create 2-3 collections per artist for first 15 artists
  for (let i = 0; i < 15; i++) {
    const numCollections = 2 + (i % 2); // 2 or 3 collections per artist
    for (let j = 0; j < numCollections; j++) {
      const collectionName =
        collectionNames[(i * 2 + j) % collectionNames.length] ||
        `Collection ${i + 1}-${j + 1}`;
      try {
        const collection = await prisma.collection.create({
          data: {
            name: `${collectionName} - ${users[i].name}`,
            description: `A curated collection of artworks by ${users[i].name}`,
            coverImage: getRandomImage(),
            visibility: j % 2 === 0 ? "public" : "private",
            createdBy: users[i].id,
          },
        });
        collections.push(collection);
        console.log(`✅ Created collection: ${collection.name}`);
      } catch (error: any) {
        if (error.code === "P2002") {
          console.log(
            `⏭️  Collection ${i + 1}-${j + 1} already exists, skipping...`,
          );
        } else {
          throw error;
        }
      }
    }
  }

  // 7. Add Artworks to Collections
  console.log("\n📝 Adding Artworks to Collections...");
  let collectionIndex = 0;
  for (const collection of collections) {
    // Add 3-5 artworks to each collection
    const numArtworks = 3 + Math.floor(Math.random() * 3);
    const userArtworks = artworks.filter(
      (a) => a.userId === collection.createdBy,
    );

    for (let i = 0; i < numArtworks && i < userArtworks.length; i++) {
      const artwork = userArtworks[i];
      if (artwork) {
        try {
          await prisma.collectionOnArtwork.upsert({
            where: {
              collectionId_artworkId: {
                collectionId: collection.id,
                artworkId: artwork.id,
              },
            },
            update: {},
            create: {
              collectionId: collection.id,
              artworkId: artwork.id,
            },
          });
          console.log(
            `✅ Added artwork "${artwork.title}" to collection "${collection.name}"`,
          );
        } catch (error: any) {
          if (error.code !== "P2002") throw error;
        }
      }
    }
    collectionIndex++;
  }

  // 8. Seed some interactions (views and likes) for engagement
  console.log("\n📝 Seeding Interactions (Views & Likes)...");
  for (let i = 0; i < Math.min(artworks.length, 30); i++) {
    const artwork = artworks[i];
    if (!artwork) continue;

    // Add some views
    for (let j = 0; j < 5 + Math.floor(Math.random() * 10); j++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      try {
        await prisma.interaction.create({
          data: {
            artworkId: artwork.id,
            userId: randomUser.id,
            type: "view",
          },
        });
      } catch (error: any) {
        // Ignore duplicates
      }
    }

    // Add some likes
    for (let j = 0; j < 2 + Math.floor(Math.random() * 5); j++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      try {
        await prisma.interaction.create({
          data: {
            artworkId: artwork.id,
            userId: randomUser.id,
            type: "LIKE",
          },
        });
      } catch (error: any) {
        // Ignore duplicates
      }
    }
  }
  console.log(`✅ Created interactions for artworks`);

  // 9. Seed some reviews
  console.log("\n📝 Seeding Reviews...");
  let reviewCounter = 0;
  for (let i = 0; i < Math.min(artworks.length, 20); i++) {
    const artwork = artworks[i];
    if (!artwork) continue;

    const randomUser = users[Math.floor(Math.random() * users.length)];
    if (randomUser.id === artwork.userId) continue; // Don't review own artwork

    try {
      await prisma.review.create({
        data: {
          id: `review_${reviewCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          artworkId: artwork.id,
          userId: randomUser.id,
          rating: 3 + Math.floor(Math.random() * 3), // 3-5 stars
          comment: `Beautiful artwork! The ${artwork.title} is truly impressive.`,
        },
      });
      reviewCounter++;
      console.log(`✅ Created review for artwork: ${artwork.title}`);
    } catch (error: any) {
      // Ignore duplicates
    }
  }

  // 10. Seed Blog Categories and Topics
  console.log("\n📝 Seeding Blog Categories and Topics...");
  const blogCategories = [];
  const blogCategoryData = [
    {
      name: "Market News",
      slug: "market-news",
      description: "Latest trends and auction results",
    },
    {
      name: "Artist Spotlight",
      slug: "artist-spotlight",
      description: "In-depth looks at rising and established artists",
    },
    {
      name: "Technique & Style",
      slug: "technique-style",
      description: "Deep dives into artistic methods",
    },
    {
      name: "Events",
      slug: "events",
      description: "Global art fairs, exhibitions, and drops",
    },
  ];

  for (const cat of blogCategoryData) {
    const category = await prisma.blogCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    blogCategories.push(category);
  }

  const blogTopics = [];
  const blogTopicData = [
    {
      name: "AI & Art",
      slug: "ai-art",
      description: "The intersection of technology and creativity",
    },
    {
      name: "Sustainability",
      slug: "sustainability",
      description: "Eco-friendly practices in the art world",
    },
    {
      name: "Urban Evolution",
      slug: "urban-evolution",
      description: "From street art to galleries",
    },
  ];

  for (const top of blogTopicData) {
    const topic = await prisma.blogTopic.upsert({
      where: { slug: top.slug },
      update: top,
      create: top,
    });
    blogTopics.push(topic);
  }

  // 11. Seed Blog Posts (News Style)
  console.log("\n📝 Seeding News-Style Blog Posts...");
  const newsBlogTopics = [
    {
      title: "Iran threatens to widen war as talks with the US hit impasse",
      subtitle:
        "Supreme leader's adviser tells CNN peace talks are deadlocked over $24 billion in frozen Iranian assets",
      badge: "EXCLUSIVE",
      layout: "HERO",
      isBreaking: true,
      mediaType: "IMAGE",
      locationTag: "TEHRAN",
      categorySlug: "market-news",
      content:
        "A detailed report on the escalating tensions and the deadlock in negotiations...",
    },
    {
      title:
        "Lego launches 12,060-piece Sagrada Família — its biggest ever set",
      subtitle: "The intricate model stands over 2 feet tall",
      badge: "LIFESTYLE",
      layout: "STANDARD",
      mediaType: "IMAGE",
      categorySlug: "technique-style",
      content:
        "Lego has unveiled its most ambitious set yet, a stunning recreation of Gaudí's masterpiece...",
    },
    {
      title:
        "Japanese citizens will join an arduous search for a missing American",
      layout: "COMPACT",
      mediaType: "IMAGE",
      locationTag: "JAPAN",
      categorySlug: "events",
      content:
        "Volunteers are joining professional search teams in the mountainous forests...",
    },
    {
      title: "Australia seizes illegal cockroaches worth $200k",
      layout: "COMPACT",
      mediaType: "VIDEO",
      videoDuration: "0:45",
      categorySlug: "market-news",
      content:
        "Biosecurity officials have intercepted a major shipment of illegal insects...",
    },
    {
      title:
        "NASA directs its ISS crew members to board spacecraft amid leak repair attempt",
      layout: "COMPACT",
      mediaType: "IMAGE",
      locationTag: "SPACE",
      categorySlug: "technique-style",
      content:
        "Precautionary measures are being taken as engineers work on a small pressure leak...",
    },
    {
      title:
        "Inside a grass scientist's 6-year quest to grow World Cup stadium turf",
      badge: "WORLD CUP",
      layout: "STANDARD",
      mediaType: "IMAGE",
      categorySlug: "technique-style",
      topicSlug: "sustainability",
      content:
        "The perfect pitch requires a perfect blend of biology and engineering...",
    },
    {
      title: "Live Updates: Four killed in Lebanon as new ceasefire frays",
      badge: "LIVE UPDATES",
      layout: "LINK_ONLY",
      isLive: true,
      categorySlug: "market-news",
      content:
        "Continuous coverage of the developing situation on the ground...",
    },
    {
      title:
        "Secret network of Israeli military sites helped sustain repeated waves of strikes in Iran",
      badge: "CNN EXCLUSIVE",
      layout: "LINK_ONLY",
      categorySlug: "market-news",
      content:
        "An investigative piece into the logistics of recent military operations...",
    },
  ];

  for (let i = 0; i < newsBlogTopics.length; i++) {
    const topic = newsBlogTopics[i];
    const author = users[i % users.length];
    const category = blogCategories.find((c) => c.slug === topic.categorySlug);
    const blogTopic = blogTopics.find((t) => t.slug === topic.topicSlug);

    // Link to a random artist for "Featured Artist"
    const featuredArtist = users[(i + 2) % users.length];

    // Link to 2 random artworks for "Shop the Story"
    const relatedArtworks = artworks.slice(i * 2, i * 2 + 2);

    try {
      const post = await prisma.blogPost.create({
        data: {
          title: topic.title,
          slug: `${topic.title
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, "")}-${Date.now()}`,
          subtitle: topic.subtitle,
          content: topic.content,
          excerpt: topic.content.substring(0, 100) + "...",
          featuredImage: getRandomImage(),
          layout: (topic.layout as any) || "STANDARD",
          badge: topic.badge,
          status: "APPROVED",
          published: true,
          publishedAt: new Date(),
          isLive: topic.isLive || false,
          isBreaking: topic.isBreaking || false,
          mediaType: (topic.mediaType as any) || "IMAGE",
          videoUrl:
            topic.mediaType === "VIDEO"
              ? "https://example.com/video.mp4"
              : null,
          videoDuration: topic.videoDuration,
          priority: 100 - i, // Higher priority for earlier items
          locationTag: topic.locationTag,
          authorId: author.id,
          categoryId: category?.id,
          topicId: blogTopic?.id,
          featuredArtistId: featuredArtist.id,
          relatedArtworks: {
            create: relatedArtworks.map((art) => ({
              artwork: { connect: { id: art.id } },
            })),
          },
          views: Math.floor(Math.random() * 1000),
          likes: Math.floor(Math.random() * 100),
        },
      });
      console.log(`✅ Created News Blog: ${post.title}`);
    } catch (error: any) {
      console.log(`⏭️  News Blog "${topic.title}" failed: ${error.message}`);
    }
  }

  console.log("\n✅ Seeding completed successfully!");

  console.log(`\n📊 Summary:`);
  console.log(`   - ${talentTypes.length} Talent Types`);
  console.log(`   - ${categories.length} Categories`);
  console.log(`   - ${users.length} Artists`);
  console.log(
    `   - ${artworks.length} Artworks (${Math.floor(artworks.length / categories.length)} per category)`,
  );
  console.log(`   - ${collections.length} Collections`);
  console.log(`   - ${newsBlogTopics.length} News Blog Posts`);
  console.log(
    `   - Artists with similar talent types for testing similar artists feature`,
  );
  console.log(
    `   - Artworks with similar categories for testing similar artworks feature`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
