import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding engagement data for trending artists...\n');

  // Get all approved artworks
  const artworks = await prisma.artwork.findMany({
    where: {
      isApproved: true,
      status: 'APPROVED',
    },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  if (artworks.length === 0) {
    console.log('⚠️  No approved artworks found. Please run db:seed:landing first.');
    return;
  }

  console.log(`📝 Found ${artworks.length} approved artworks\n`);

  // Get all users (for creating interactions)
  const users = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  if (users.length === 0) {
    console.log('⚠️  No users found. Please run db:seed:landing first.');
    return;
  }

  console.log(`👥 Found ${users.length} users for interactions\n`);

  // Seed interactions (VIEW and LIKE)
  console.log('📝 Seeding Interactions (Views and Likes)...');
  let viewCount = 0;
  let likeCount = 0;

  for (const artwork of artworks) {
    // Create views for each artwork (more views = more popular)
    // Give some artworks more views than others to create trending effect
    const baseViews = Math.floor(Math.random() * 20) + 5; // 5-25 views
    const popularityMultiplier = Math.random() > 0.5 ? 2 : 1; // Some artworks are more popular
    const totalViews = Math.floor(baseViews * popularityMultiplier);

    for (let i = 0; i < totalViews; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await prisma.interaction.create({
        data: {
          artworkId: artwork.id,
          userId: randomUser.id,
          type: 'VIEW',
          metadata: {
            source: 'web',
            timestamp: new Date().toISOString(),
          },
        },
      });
      viewCount++;
    }

    // Create likes for some artworks (not all artworks get likes)
    // More popular artworks get more likes
    if (Math.random() > 0.3) {
      // 70% of artworks get at least some likes
      const totalLikes = Math.floor(Math.random() * 15) + 1; // 1-15 likes
      const likeUsers = new Set<string>();

      for (let i = 0; i < totalLikes; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        // Avoid duplicate likes from same user
        if (!likeUsers.has(randomUser.id) && randomUser.id !== artwork.userId) {
          likeUsers.add(randomUser.id);
          await prisma.interaction.create({
            data: {
              artworkId: artwork.id,
              userId: randomUser.id,
              type: 'LIKE',
              metadata: {
                timestamp: new Date().toISOString(),
              },
            },
          });
          likeCount++;
        }
      }
    }

    console.log(`✅ Artwork "${artwork.title || artwork.id}": ${totalViews} views, ${likeCount} likes`);
  }

  console.log(`\n✅ Created ${viewCount} views and ${likeCount} likes\n`);

  // Seed comments
  console.log('📝 Seeding Comments...');
  let commentCount = 0;

  for (const artwork of artworks) {
    // 60% of artworks get comments
    if (Math.random() > 0.4) {
      const totalComments = Math.floor(Math.random() * 8) + 1; // 1-8 comments
      const commentAuthors = [
        'Art Lover',
        'Collector',
        'Gallery Visitor',
        'Art Enthusiast',
        'Curator',
        'Art Critic',
        'Buyer',
        'Fan',
      ];

      for (let i = 0; i < totalComments; i++) {
        const author = commentAuthors[Math.floor(Math.random() * commentAuthors.length)];
        const comments = [
          'Beautiful piece!',
          'Love the colors and composition.',
          'This is stunning work.',
          'Would love to see more from this artist.',
          'Excellent craftsmanship.',
          'The detail is incredible.',
          'This speaks to me.',
          'Amazing artwork!',
          'Very impressive.',
          'Great addition to any collection.',
        ];

        await prisma.comment.create({
          data: {
            artworkId: artwork.id,
            authorName: `${author} ${i + 1}`,
            content: comments[Math.floor(Math.random() * comments.length)],
          },
        });
        commentCount++;
      }
    }
  }

  console.log(`✅ Created ${commentCount} comments\n`);

  // Seed favorites
  console.log('📝 Seeding Favorites...');
  let favoriteCount = 0;

  for (const artwork of artworks) {
    // 50% of artworks get favorited
    if (Math.random() > 0.5) {
      const totalFavorites = Math.floor(Math.random() * 10) + 1; // 1-10 favorites
      const favoriteUsers = new Set<string>();

      for (let i = 0; i < totalFavorites; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        // Avoid duplicate favorites from same user
        if (!favoriteUsers.has(randomUser.id) && randomUser.id !== artwork.userId) {
          favoriteUsers.add(randomUser.id);
          
          // Check if favorite already exists
          const existing = await prisma.favorite.findFirst({
            where: {
              userId: randomUser.id,
              artworkId: artwork.id,
            },
          });

          if (!existing) {
            await prisma.favorite.create({
              data: {
                userId: randomUser.id,
                artworkId: artwork.id,
              },
            });
            favoriteCount++;
          }
        }
      }
    }
  }

  console.log(`✅ Created ${favoriteCount} favorites\n`);

  // Show summary by artist
  console.log('📊 Engagement Summary by Artist:\n');
  
  const artistStats = new Map<string, {
    views: number;
    likes: number;
    comments: number;
    favorites: number;
    artworks: number;
  }>();

  for (const artwork of artworks) {
    if (!artwork.artist) continue;

    const stats = artistStats.get(artwork.artist) || {
      views: 0,
      likes: 0,
      comments: 0,
      favorites: 0,
      artworks: 0,
    };

    // Count interactions for this artwork
    const artworkInteractions = await prisma.interaction.findMany({
      where: { artworkId: artwork.id },
    });

    stats.views += artworkInteractions.filter(i => i.type.toUpperCase() === 'VIEW').length;
    stats.likes += artworkInteractions.filter(i => i.type.toUpperCase() === 'LIKE').length;

    // Count comments
    const artworkComments = await prisma.comment.findMany({
      where: { artworkId: artwork.id },
    });
    stats.comments += artworkComments.length;

    // Count favorites
    const artworkFavorites = await prisma.favorite.findMany({
      where: { artworkId: artwork.id },
    });
    stats.favorites += artworkFavorites.length;

    stats.artworks += 1;

    artistStats.set(artwork.artist, stats);
  }

  // Sort by engagement score
  const sortedArtists = Array.from(artistStats.entries())
    .map(([name, stats]) => ({
      name,
      ...stats,
      engagementScore: stats.views * 1 + stats.likes * 3 + stats.comments * 2 + stats.favorites * 2 + stats.artworks * 1,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore);

  sortedArtists.forEach((artist, index) => {
    console.log(`${index + 1}. ${artist.name}`);
    console.log(`   Artworks: ${artist.artworks} | Views: ${artist.views} | Likes: ${artist.likes} | Comments: ${artist.comments} | Favorites: ${artist.favorites}`);
    console.log(`   Engagement Score: ${artist.engagementScore}\n`);
  });

  console.log(`\n✅ Engagement data seeding completed!`);
  console.log(`   - ${viewCount} views created`);
  console.log(`   - ${likeCount} likes created`);
  console.log(`   - ${commentCount} comments created`);
  console.log(`   - ${favoriteCount} favorites created`);
  console.log(`\n🎨 Trending artists section should now display artists based on engagement!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding engagement data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


