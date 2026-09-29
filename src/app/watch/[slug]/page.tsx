import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_DESCRIPTION } from "@/lib/site";
import { storagePublicUrl, streamUrl } from "@/lib/storage";

const RESUME_MIN_SEC = 30;

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
  if (!content) return { title: "콘텐츠를 찾을 수 없습니다" };
  const description = content.description ?? SITE_DESCRIPTION;
  const image = content.posterPath
    ? storagePublicUrl(content.posterPath)
    : undefined;
  return {
    title: content.title,
    description,
    alternates: { canonical: `/watch/${slug}` },
    openGraph: {
      type: "video.other",
      url: `/watch/${slug}`,
      title: content.title,
      description,
      images: image
        ? [{ url: image, width: 1280, height: 667, alt: content.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: content.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function WatchPage({
  params,
  searchParams,
}: PageProps<"/watch/[slug]">) {
  const { slug } = await params;
  const { restart } = await searchParams;
  const content = await getContent(slug);
  if (!content) notFound();
  const user = await getUser();
  const loginHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;
  if (!user && !content.trailerPath) redirect(loginHref);
  const trailerOnly = !user;

  const history = user
    ? await prisma.watchHistory.findUnique({
        where: { userId_contentId: { userId: user.id, contentId: content.id } },
        select: { positionSec: true, completed: true },
      })
    : null;
  const startAt =
    !restart &&
    history &&
    !history.completed &&
    history.positionSec >= RESUME_MIN_SEC
      ? history.positionSec
      : undefined;

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
        historyContentId={content.id}
        startAt={startAt}
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
