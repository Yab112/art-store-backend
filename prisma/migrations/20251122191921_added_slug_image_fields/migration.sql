/*
  Warnings:

  - You are about to drop the column `icon` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `technique` on the `artworks` table. All the data in the column will be lost.
  - You are about to drop the `SubCategory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."SubCategory" DROP CONSTRAINT "SubCategory_categoryId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "icon",
ADD COLUMN     "image" TEXT,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "artworks" DROP COLUMN "technique";

-- DropTable
DROP TABLE "public"."SubCategory";

-- CreateTable
CREATE TABLE "ArtworkOnCategory" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ArtworkOnCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkOnCategory_artworkId_categoryId_key" ON "ArtworkOnCategory"("artworkId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- AddForeignKey
ALTER TABLE "ArtworkOnCategory" ADD CONSTRAINT "ArtworkOnCategory_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkOnCategory" ADD CONSTRAINT "ArtworkOnCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
