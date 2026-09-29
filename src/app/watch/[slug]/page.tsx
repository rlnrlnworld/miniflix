import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { prisma } from "@/lib/prisma";
import { storagePublicUrl } from "@/lib/storage";

async function getContent(slug: string) {
  return prisma.content.findUnique({
    where: { slug },
    include: { subtitles: { orderBy: { lang: "asc" } } },
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/watch/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const content = await getContent(slug);
  return { title: content ? `${content.title} · miniflix` : "miniflix" };
}

export default async function WatchPage({
  params,
}: PageProps<"/watch/[slug]">) {
  const { slug } = await params;
  const content = await getContent(slug);
  if (!content) notFound();

  return (
    <main className="bg-paper text-ink flex min-h-dvh flex-col">
      <HlsPlayer
        title={content.title}
        src={storagePublicUrl(content.masterPath)}
        poster={
          content.posterPath ? storagePublicUrl(content.posterPath) : undefined
        }
        subtitles={content.subtitles.map((s) => ({
          lang: s.lang,
          label: s.label,
          src: storagePublicUrl(s.vttPath),
          isDefault: s.isDefault,
        }))}
      />
    </main>
  );
}
