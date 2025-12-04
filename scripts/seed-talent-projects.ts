import { PrismaClient, ArtworkStatus } from "@prisma/client";

const prisma = new PrismaClient();

// S3 Base URL
const S3_BASE_URL = "https://art-gallery-s3-bucket.s3.eu-north-1.amazonaws.com/images";

// Real S3 images available
const S3_IMAGES = [
  "05cee9bf-0c12-4e23-b22c-7da905c2a12f.jpg",
  "05f10c53-4016-4ddf-bbaa-2211d13d17c6.webp",
  "06cc265b-8a9b-4c48-a0d4-22a4d39101b3.jpg",
  "081d31bf-10f4-47f0-8b25-705a7b8bfb27.png",
  "0c57e5c8-2031-4d3d-a9d5-11d282adfaaf.jpg",
  "0ea1e2b3-f87a-4d41-b23f-dca1f13780a2.png",
  "10b35a8c-17a3-4c09-a3fd-1cf9cd1ed961.png",
  "23b77d70-3bc4-480e-a288-e4a21adaa68f.jpg",
  "2c18227f-83a1-4be9-a13d-eb6fd286e349.jpg",
];

// Helper to get S3 image URL
const getImageUrl = (filename: string) => `${S3_BASE_URL}/${filename}`;

// Helper to get random S3 image
const getRandomImage = () => getImageUrl(S3_IMAGES[Math.floor(Math.random() * S3_IMAGES.length)]);

// Artwork titles by talent type
const artworkTitlesByTalent: Record<string, string[]> = {
  painter: [
    "Abstract Expression", "Color Harmony", "Brush Strokes", "Canvas Dreams", "Oil Masterpiece",
    "Watercolor Flow", "Acrylic Vision", "Portrait Study", "Landscape Serenity", "Still Life"
  ],
  photographer: [
    "Urban Moments", "Nature's Frame", "Portrait Session", "Street Life", "Architectural Lines",
    "Wildlife Capture", "Event Photography", "Fine Art Photo", "Documentary Shot", "Creative Vision"
  ],
  "digital-artist": [
    "Digital Dreams", "Pixel Art", "3D Render", "Vector Design", "Digital Illustration",
    "NFT Creation", "Concept Art", "Digital Portrait", "Abstract Digital", "Cyber Art"
  ],
  sculptor: [
    "Marble Form", "Bronze Figure", "Clay Creation", "Wood Carving", "Metal Sculpture",
    "Stone Art", "Abstract Sculpture", "Figurative Work", "Installation Piece", "Mixed Material"
  ],
  calligrapher: [
    "Elegant Script", "Arabic Calligraphy", "Modern Lettering", "Traditional Writing", "Decorative Text",
    "Wedding Invitation", "Quote Art", "Name Design", "Poetry Calligraphy", "Ornamental Text"
  ],
  "tattoo-artist": [
    "Tattoo Design", "Sleeve Art", "Portrait Tattoo", "Geometric Pattern", "Traditional Style",
    "Realistic Tattoo", "Minimalist Design", "Colorful Piece", "Black & Gray", "Custom Artwork"
  ],
  "fashion-designer": [
    "Fashion Collection", "Textile Design", "Pattern Creation", "Garment Design", "Accessory Line",
    "Fashion Sketch", "Fabric Art", "Style Concept", "Runway Piece", "Couture Design"
  ],
  "mixed-media": [
    "Combined Elements", "Layered Art", "Multi-Material", "Experimental Piece", "Fusion Art",
    "Collage Work", "Assemblage", "Mixed Technique", "Hybrid Creation", "Cross-Media"
  ],
  illustrator: [
    "Book Illustration", "Character Design", "Story Art", "Editorial Illustration", "Children's Book",
    "Fantasy Art", "Comic Style", "Graphic Novel", "Concept Sketch", "Digital Illustration"
  ],
  ceramicist: [
    "Pottery Vase", "Ceramic Bowl", "Sculptural Pottery", "Functional Art", "Decorative Piece",
    "Glazed Creation", "Raku Fired", "Porcelain Work", "Stoneware Art", "Clay Sculpture"
  ],
  "street-artist": [
    "Mural Design", "Graffiti Art", "Street Mural", "Wall Art", "Public Art",
    "Spray Paint Art", "Urban Canvas", "Community Art", "Large Scale", "Public Installation"
  ],
  other: [
    "Unique Creation", "Experimental Art", "Innovative Piece", "Artistic Work", "Creative Project",
    "Original Art", "Custom Creation", "Special Artwork", "One of a Kind", "Artistic Expression"
  ],
};

// Category mapping for talent types
const categoryMapping: Record<string, string[]> = {
  painter: ["painting", "drawing"],
  photographer: ["photography"],
  "digital-artist": ["digital-art", "drawing"],
  sculptor: ["sculpture"],
  calligrapher: ["drawing", "print"],
  "tattoo-artist": ["drawing", "digital-art"],
  "fashion-designer": ["textile", "mixed-media"],
  "mixed-media": ["mixed-media"],
  illustrator: ["drawing", "digital-art", "print"],
  ceramicist: ["ceramics"],
  "street-artist": ["painting", "mixed-media"],
  other: ["mixed-media"],
};

async function main() {
  console.log("🌱 Seeding Projects (Artworks) for Talent Types...\n");

  // Get all talent types
  const talentTypes = await prisma.talentType.findMany({
    orderBy: { sortOrder: "asc" },
  });

  if (talentTypes.length === 0) {
    console.log("❌ No talent types found. Please run the main seed script first.");
    return;
  }

  console.log(`📋 Found ${talentTypes.length} talent types\n`);

  // Get all categories
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map(cat => [cat.slug, cat]));

  let totalArtworksCreated = 0;

  // Loop through each talent type
  for (const talentType of talentTypes) {
    console.log(`\n🎨 Processing Talent Type: ${talentType.name} (${talentType.slug})`);

    // Find or get artists with this talent type
    const artistsWithTalent = await prisma.user.findMany({
      where: {
        talentTypes: {
          some: {
            talentTypeId: talentType.id,
          },
        },
      },
      take: 10, // Limit to 10 artists per talent type
    });

    // If no artists found, create one
    let artists = artistsWithTalent;
    if (artists.length === 0) {
      console.log(`   ⚠️  No artists found for ${talentType.name}, creating one...`);
      const newArtist = await prisma.user.create({
        data: {
          name: `${talentType.name} Artist`,
          email: `${talentType.slug}-artist@example.com`,
          role: "USER",
          emailVerified: true,
          image: getRandomImage(),
          coverImage: getRandomImage(),
          bio: `A talented ${talentType.name.toLowerCase()} with years of experience.`,
          location: "Ethiopia",
          website: `https://${talentType.slug}-artist.com`,
          talentTypes: {
            create: {
              talentTypeId: talentType.id,
            },
          },
        },
      });
      artists = [newArtist];
      console.log(`   ✅ Created artist: ${newArtist.name}`);
    }

    // Get artwork titles for this talent type
    const titles = artworkTitlesByTalent[talentType.slug] || artworkTitlesByTalent.other;
    const relevantCategories = categoryMapping[talentType.slug] || ["mixed-media"];

    // Create 3-5 artworks per artist for this talent type
    const artworksPerArtist = 3 + Math.floor(Math.random() * 3); // 3-5 artworks

    for (const artist of artists) {
      for (let i = 0; i < artworksPerArtist; i++) {
        const titleIndex = (totalArtworksCreated + i) % titles.length;
        const title = `${titles[titleIndex]} - ${talentType.name}`;
        
        // Select a relevant category
        const categorySlug = relevantCategories[Math.floor(Math.random() * relevantCategories.length)];
        let category = categoryMap.get(categorySlug);
        
        // Fallback to first available category if mapped category doesn't exist
        if (!category && categories.length > 0) {
          category = categories[0];
        }

        try {
          const artwork = await prisma.artwork.create({
            data: {
              title: title,
              artist: artist.name,
              support: ["Canvas", "Paper", "Wood", "Metal", "Fabric", "Digital"][i % 6],
              state: ["Excellent", "Good", "Very Good", "Mint", "Fine"][i % 5],
              yearOfArtwork: String(2018 + (totalArtworksCreated % 7)),
              dimensions: {
                width: 30 + (totalArtworksCreated % 50) * 2,
                height: 40 + (totalArtworksCreated % 50) * 2,
                depth: totalArtworksCreated % 2 === 0 ? 2 : undefined,
                unit: "cm",
              },
              isFramed: totalArtworksCreated % 2 === 0,
              weight: `${0.5 + (totalArtworksCreated % 5) * 0.3}kg`,
              handDeliveryAccepted: true,
              origin: artist.location || "Ethiopia",
              yearOfAcquisition: String(2020 + (totalArtworksCreated % 5)),
              description: `A beautiful ${talentType.name.toLowerCase()} artwork by ${artist.name}. This piece showcases the artist's expertise in ${talentType.description || talentType.name.toLowerCase()}.`,
              desiredPrice: 300 + (totalArtworksCreated % 25) * 200,
              acceptPriceNegotiation: totalArtworksCreated % 3 !== 0,
              accountHolder: artist.name,
              iban: `ET${String(totalArtworksCreated).padStart(22, "0")}`,
              bicCode: `ETBIC${totalArtworksCreated}`,
              acceptTermsOfSale: true,
              giveSalesMandate: true,
              photos: [getRandomImage(), getRandomImage()],
              status: ArtworkStatus.APPROVED,
              isApproved: true,
              userId: artist.id,
              categories: category
                ? {
                    create: {
                      categoryId: category.id,
                    },
                  }
                : undefined,
            },
          });

          totalArtworksCreated++;
          console.log(`   ✅ Created artwork: "${artwork.title}" by ${artist.name} (€${artwork.desiredPrice})`);
        } catch (error: any) {
          if (error.code === "P2002") {
            console.log(`   ⏭️  Artwork already exists, skipping...`);
          } else {
            console.error(`   ❌ Error creating artwork:`, error.message);
          }
        }
      }
    }

    console.log(`   📊 Created ${artworksPerArtist} artworks per artist for ${talentType.name}`);
  }

  console.log("\n✅ Seeding completed successfully!");
  console.log(`\n📊 Summary:`);
  console.log(`   - ${talentTypes.length} Talent Types processed`);
  console.log(`   - ${totalArtworksCreated} Artworks (Projects) created`);
  console.log(`   - Artworks distributed across talent types and artists`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

