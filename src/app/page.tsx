import { ContentRow } from "@/components/content/content-row";
import { Hero } from "@/components/content/hero";
import { SiteHeader } from "@/components/site/site-header";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { storagePublicUrl } from "@/lib/storage";

export const metadata = { alternates: { canonical: "/" } };

const RESUME_MIN_SEC = 30;

export default async function HomePage() {
  const user = await getUser();
  const [contents, histories] = await Promise.all([
    prisma.content.findMany({
      orderBy: { createdAt: "desc" },
      include: { subtitles: { select: { lang: true, label: true } } },
    }),
    user
      ? prisma.watchHistory.findMany({
          where: {
            userId: user.id,
            completed: false,
            positionSec: { gte: RESUME_MIN_SEC },
          },
          orderBy: { lastWatchedAt: "desc" },
          take: 12,
          include: { content: true },
        })
      : Promise.resolve([]),
  ]);
  const featured = contents[0];
  const continueItems = histories.map((h) => ({
    ...h.content,
    progress: h.positionSec / h.content.durationSec,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: siteUrl().toString(),
        inLanguage: "ko",
      },
      {
        "@type": "ItemList",
        itemListElement: contents.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "VideoObject",
            name: c.title,
            description: c.description ?? undefined,
            duration: `PT${c.durationSec}S`,
            thumbnailUrl: c.thumbnailPath
              ? storagePublicUrl(c.thumbnailPath)
              : undefined,
            url: new URL(`/watch/${c.slug}`, siteUrl()).toString(),
          },
        })),
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-paper text-ink min-h-dvh pb-16">
        {featured ? (
          <Hero content={featured} preview={!user} />
        ) : (
          <section className="mx-auto w-full max-w-7xl px-4 pt-32 sm:px-8">
            <h1 className="text-2xl font-bold">아직 콘텐츠가 없습니다</h1>
          </section>
        )}
        <div className="relative -mt-6 flex flex-col gap-10 sm:-mt-10">
          <ContentRow title="이어보기" items={continueItems} />
          <ContentRow title="지금 볼 수 있는 콘텐츠" items={contents} />
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
