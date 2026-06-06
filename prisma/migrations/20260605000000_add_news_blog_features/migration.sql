-- CreateEnum
CREATE TYPE "BlogPostLayout" AS ENUM ('HERO', 'STANDARD', 'COMPACT', 'LINK_ONLY');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'LIVE_STREAM');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true, 
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "artworks" ALTER COLUMN "iban" DROP NOT NULL;

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "ctaLink" TEXT,
ADD COLUMN     "ctaText" TEXT,
ADD COLUMN     "dropDate" TIMESTAMP(3),
ADD COLUMN     "featuredArtistId" TEXT,
ADD COLUMN     "isBreaking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDrop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "layout" "BlogPostLayout" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "locationTag" TEXT,
ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "topicId" TEXT,
ADD COLUMN     "videoDuration" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "blog_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts_on_artworks" (
    "id" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,

    CONSTRAINT "blog_posts_on_artworks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");    

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");    

-- CreateIndex
CREATE UNIQUE INDEX "blog_topics_name_key" ON "blog_topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_topics_slug_key" ON "blog_topics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_on_artworks_blogPostId_artworkId_key" ON "blog_posts_on_artworks"("blogPostId", "artworkId");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "blog_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;  

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featuredArtistId_fkey" FOREIGN KEY ("featuredArtistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts_on_artworks" ADD CONSTRAINT "blog_posts_on_artworks_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts_on_artworks" ADD CONSTRAINT "blog_posts_on_artworks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
