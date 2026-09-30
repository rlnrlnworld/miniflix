/*
  Warnings:

  - A unique constraint covering the columns `[seriesId,episodeNo]` on the table `Content` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "episodeNo" INTEGER,
ADD COLUMN     "seriesId" UUID;

-- CreateTable
CREATE TABLE "Series" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "posterPath" VARCHAR(255),
    "thumbnailPath" VARCHAR(255),
    "trailerPath" VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Content_seriesId_episodeNo_key" ON "Content"("seriesId", "episodeNo");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
