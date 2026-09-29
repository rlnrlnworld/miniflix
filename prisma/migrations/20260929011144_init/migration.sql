-- CreateTable
CREATE TABLE "Content" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "durationSec" INTEGER NOT NULL,
    "masterPath" VARCHAR(255) NOT NULL,
    "posterPath" VARCHAR(255),
    "thumbnailPath" VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtitle" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "lang" VARCHAR(16) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "vttPath" VARCHAR(255) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(20) NOT NULL,
    "avatarUrl" VARCHAR(500),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastWatchedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_contentId_lang_key" ON "Subtitle"("contentId", "lang");

-- CreateIndex
CREATE INDEX "WatchHistory_userId_lastWatchedAt_idx" ON "WatchHistory"("userId", "lastWatchedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WatchHistory_userId_contentId_key" ON "WatchHistory"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
