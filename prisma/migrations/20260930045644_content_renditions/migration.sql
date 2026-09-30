-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "renditions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
