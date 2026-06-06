import { PrismaClient, BlogPostStatus, BlogPostLayout, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Redesign Blogs...');

  // 1. Get or Create a Category
  const category = await prisma.blogCategory.upsert({
    where: { slug: 'art-news' },
    update: {},
    create: {
      name: 'Art News',
      slug: 'art-news',
      description: 'The latest updates from the art world.',
    },
  });

  const marketCategory = await prisma.blogCategory.upsert({
    where: { slug: 'art-market' },
    update: {},
    create: {
      name: 'Art Market',
      slug: 'art-market',
      description: 'Insights into the art market trends.',
    },
  });

  // 2. Get an existing user to be the author
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error('No user found to assign as author. Please run the main seed first or create a user.');
  }

  const authorId = user.id;

  // 3. Clear existing blogs if you want a clean slate (optional)
  // await prisma.blogPost.deleteMany({ where: { slug: { startsWith: 'seed-' } } });

  const blogs = [
    {
      title: "The Silent Language of Abstract Expressionism",
      subtitle: "How artists communicate complex emotions without a single recognizable form.",
      slug: "silent-language-abstract-expressionism",
      excerpt: "Abstract art often leaves viewers asking, 'What does it mean?' Abstract Expressionism, which emerged in the mid-20th century, provides a profound answer.",
      content: "Full content of the blog post goes here...",
      contentHtml: "<p>Abstract art often leaves viewers asking, 'What does it mean?' Abstract Expressionism, which emerged in the mid-20th century, provides a profound answer.</p>",
      featuredImage: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=2000&auto=format&fit=crop",
      layout: "HERO" as BlogPostLayout,
      status: "APPROVED" as BlogPostStatus,
      published: true,
      publishedAt: new Date(),
      authorId,
      categoryId: category.id,
      isBreaking: true,
      readingTimeMin: 8,
      views: 12500,
    },
    {
      title: "Watch: Restoring a Masterpiece",
      slug: "watch-restoring-masterpiece",
      excerpt: "Go behind the scenes at the Louvre to see how 500-year-old oil paintings are brought back to life.",
      content: "Video content description...",
      featuredImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2000&auto=format&fit=crop",
      layout: "STANDARD" as BlogPostLayout,
      mediaType: "VIDEO" as MediaType,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoDuration: "12:45",
      status: "APPROVED" as BlogPostStatus,
      published: true,
      publishedAt: new Date(Date.now() - 3600000), // 1h ago
      authorId,
      categoryId: category.id,
      readingTimeMin: 4,
      views: 4500,
    },
    {
      title: "The Rise of Digital Collectibles in 2026",
      slug: "rise-digital-collectibles-2026",
      excerpt: "Why traditional galleries are finally embracing the blockchain for authentication.",
      content: "Market analysis...",
      featuredImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000&auto=format&fit=crop",
      layout: "OVERLAY" as BlogPostLayout,
      status: "APPROVED" as BlogPostStatus,
      published: true,
      publishedAt: new Date(Date.now() - 7200000), // 2h ago
      authorId,
      categoryId: marketCategory.id,
      readingTimeMin: 12,
      views: 8900,
    },
    {
      title: "Global Art Fair Schedule Released",
      slug: "global-art-fair-schedule-2026",
      excerpt: "From Basel to Miami, here are the dates you need to know for the upcoming season.",
      content: "Schedule details...",
      featuredImage: "https://images.unsplash.com/photo-1492691523567-6119e2d992e8?q=80&w=2000&auto=format&fit=crop",
      layout: "COMPACT" as BlogPostLayout,
      status: "APPROVED" as BlogPostStatus,
      published: true,
      publishedAt: new Date(Date.now() - 10800000), // 3h ago
      authorId,
      categoryId: marketCategory.id,
      isLive: true,
      readingTimeMin: 3,
      views: 3200,
    },
    {
        title: "The Evolution of Street Art",
        slug: "evolution-street-art",
        excerpt: "From subway cars to prestigious auction houses, how graffiti became fine art.",
        content: "History of street art...",
        featuredImage: "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?q=80&w=2000&auto=format&fit=crop",
        layout: "SIDEBAR" as BlogPostLayout,
        status: "APPROVED" as BlogPostStatus,
        published: true,
        publishedAt: new Date(Date.now() - 14400000), // 4h ago
        authorId,
        categoryId: category.id,
        readingTimeMin: 6,
        views: 5600,
      },
      {
        title: "New Museum Opening in Tokyo",
        slug: "new-museum-tokyo",
        excerpt: "A look inside the highly anticipated TeamLab Borderless relocation.",
        content: "Museum review...",
        featuredImage: "https://images.unsplash.com/photo-1518998053502-519086f75231?q=80&w=2000&auto=format&fit=crop",
        layout: "TEXT_ONLY" as BlogPostLayout,
        status: "APPROVED" as BlogPostStatus,
        published: true,
        publishedAt: new Date(Date.now() - 18000000), // 5h ago
        authorId,
        categoryId: category.id,
        readingTimeMin: 5,
        views: 2100,
      }
  ];

  // Add more generic blogs to fill the grid (total 30+ to test all sections)
  for (let i = 1; i <= 30; i++) {
    blogs.push({
      title: `Art Story #${i}: Exploring the ${['Renaissance', 'Baroque', 'Modern', 'Minimalist'][i % 4]} Style`,
      slug: `art-story-seed-${i}`,
      excerpt: `Discover the intricate details and historical context of the ${['Renaissance', 'Baroque', 'Modern', 'Minimalist'][i % 4]} art movement and its impact on today's artists.`,
      content: "Generic content...",
      featuredImage: `https://picsum.photos/seed/art${i}/800/600`,
      layout: "STANDARD" as BlogPostLayout,
      status: "APPROVED" as BlogPostStatus,
      published: true,
      publishedAt: new Date(Date.now() - (i * 3600000 * 2)), // spread out over time
      authorId,
      categoryId: category.id,
      readingTimeMin: Math.floor(Math.random() * 10) + 2,
      views: Math.floor(Math.random() * 5000) + 100,
      subtitle: undefined,
      contentHtml: undefined,
      contentFormat: "tiptap/v1",
      badge: undefined,
      isLive: i % 7 === 0,
      isBreaking: i % 10 === 0,
      isDrop: false,
      dropDate: null,
      mediaType: i % 5 === 0 ? "VIDEO" as MediaType : "IMAGE" as MediaType,
      videoUrl: i % 5 === 0 ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
      videoDuration: i % 5 === 0 ? "5:30" : null,
      priority: 0,
      locationTag: i % 3 === 0 ? "Global" : null,
      ctaText: null,
      ctaLink: null,
      lastAutoSavedAt: null,
      editedAt: null,
      topicId: null,
      featuredArtistId: null
    } as any);
  }

  for (const blog of blogs) {
    await prisma.blogPost.upsert({
      where: { slug: blog.slug },
      update: blog,
      create: blog,
    });
  }

  console.log(`✅ Successfully seeded ${blogs.length} blog posts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
