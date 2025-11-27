-- AlterTable
ALTER TABLE "users" ADD COLUMN     "heatScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "languagePreference" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "messagingPreferences" JSONB,
ADD COLUMN     "profileViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "talentTypeId" TEXT,
ADD COLUMN     "themePreference" TEXT NOT NULL DEFAULT 'light',
ADD COLUMN     "timezone" TEXT DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "talent_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_types_name_key" ON "talent_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "talent_types_slug_key" ON "talent_types"("slug");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_talentTypeId_fkey" FOREIGN KEY ("talentTypeId") REFERENCES "talent_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
