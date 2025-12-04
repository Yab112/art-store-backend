/*
  Warnings:

  - You are about to drop the column `icon` on the `talent_types` table. All the data in the column will be lost.
  - You are about to drop the column `talentTypeId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_talentTypeId_fkey";

-- AlterTable
ALTER TABLE "talent_types" DROP COLUMN "icon",
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "talentTypeId";

-- CreateTable
CREATE TABLE "user_on_talent_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "talentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_on_talent_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_on_talent_types_userId_talentTypeId_key" ON "user_on_talent_types"("userId", "talentTypeId");

-- AddForeignKey
ALTER TABLE "user_on_talent_types" ADD CONSTRAINT "user_on_talent_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_on_talent_types" ADD CONSTRAINT "user_on_talent_types_talentTypeId_fkey" FOREIGN KEY ("talentTypeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
