/*
  Warnings:

  - Added the required column `createdBy` to the `Collection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'private';

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
