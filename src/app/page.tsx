import { ContentRow } from "@/components/content/content-row";
import { Hero } from "@/components/content/hero";
import { SiteHeader } from "@/components/site/site-header";
import { prisma } from "@/lib/prisma";
import { storagePublicUrl } from "@/lib/storage";

export default async function HomePage() {
  const contents = await prisma.content.findMany({
    orderBy: { createdAt: "desc" },
    include: { subtitles: { select: { lang: true, label: true } } },
  });
  const featured = contents[0];

  const jsonLd = {
    "@context": "https://schema.org",
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
        url: `/watch/${c.slug}`,
      },
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-paper text-ink min-h-dvh pb-16">
        {featured ? (
          <Hero content={featured} />
        ) : (
          <section className="mx-auto w-full max-w-7xl px-4 pt-32 sm:px-8">
            <h1 className="text-2xl font-bold">아직 콘텐츠가 없습니다</h1>
          </section>
        )}
        <div className="relative -mt-6 flex flex-col gap-10 sm:-mt-10">
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
