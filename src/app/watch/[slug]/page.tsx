import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { getUser } from "@/lib/auth";
import { getTitle } from "@/lib/content";
import { SITE_DESCRIPTION } from "@/lib/site";
import { storagePublicUrl, streamUrl } from "@/lib/storage";

function displayTitle(c: {
  title: string;
  episodeNo: number | null;
  series: { title: string } | null;
}) {
  return c.series && c.episodeNo !== null
    ? `${c.series.title} ${c.episodeNo}화 · ${c.title}`
    : c.title;
}

export async function generateMetadata({
  params,
}: PageProps<"/watch/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTitle(slug, null);
  if (!data) return { title: "콘텐츠를 찾을 수 없습니다" };
  const { content } = data;
  const title = displayTitle(content);
  const description = content.description ?? SITE_DESCRIPTION;
  const image = content.posterPath
    ? storagePublicUrl(content.posterPath)
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/watch/${slug}` },
    openGraph: {
      type: "video.other",
      url: `/watch/${slug}`,
      title,
      description,
      images: image
        ? [{ url: image, width: 1280, height: 667, alt: content.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
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
  const user = await getUser();
  const data = await getTitle(slug, user?.id ?? null);
  if (!data) notFound();
  const { content, resumeAt, nextEpisode } = data;
  const loginHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;
  if (!user && !content.trailerPath) redirect(loginHref);
  const trailerOnly = !user;
  const startAt = !restart && resumeAt ? resumeAt : undefined;

  return (
    <main className="bg-paper text-ink flex min-h-dvh flex-col">
      <HlsPlayer
        title={displayTitle(content)}
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
        nextEpisode={
          !trailerOnly && nextEpisode
            ? {
                href: `/watch/${nextEpisode.slug}`,
                title: `${nextEpisode.episodeNo}화 · ${nextEpisode.title}`,
              }
            : undefined
        }
        thumbnails={
          !trailerOnly && content.thumbsVttPath
            ? storagePublicUrl(content.thumbsVttPath)
            : undefined
        }
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
