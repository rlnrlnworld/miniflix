import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storagePublicUrl, streamUrl } from "@/lib/storage";

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
  const user = await getUser();
  const loginHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;
  if (!user && !content.trailerPath) redirect(loginHref);
  const trailerOnly = !user;

  return (
    <main className="bg-paper text-ink flex min-h-dvh flex-col">
      <HlsPlayer
        title={content.title}
        description={content.description}
        src={
          trailerOnly
            ? storagePublicUrl(content.trailerPath!)
            : streamUrl(content.slug)
        }
        mode={trailerOnly ? "trailer" : "full"}
        loginHref={loginHref}
        poster={
          content.posterPath ? storagePublicUrl(content.posterPath) : undefined
        }
        subtitles={(trailerOnly ? [] : content.subtitles).map((s) => ({
          lang: s.lang,
          label: s.label,
          src: storagePublicUrl(s.vttPath),
          isDefault: s.isDefault,
        }))}
      />
    </main>
  );
}
