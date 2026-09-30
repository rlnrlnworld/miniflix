import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { getUser } from "@/lib/auth";
import { getRecommendations, getTitle } from "@/lib/content";
import { formatDuration } from "@/lib/format";
import { SITE_DESCRIPTION } from "@/lib/site";
import { storagePublicUrl, streamUrl } from "@/lib/storage";

function imageUrl(path: string | null | undefined) {
  return path ? storagePublicUrl(path) : null;
}

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
  const { content, resumeAt, nextEpisode, episodes } = data;
  const loginHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;
  if (!user && !content.trailerPath) redirect(loginHref);
  const trailerOnly = !user;
  const startAt = !restart && resumeAt ? resumeAt : undefined;
  // 종료 오버레이 카드: 다음 화가 있으면 다음 화, 없으면(단편·마지막 화) 추천 1편.
  const endCard = trailerOnly
    ? null
    : nextEpisode
      ? {
          href: `/watch/${nextEpisode.slug}`,
          eyebrow: "다음 화",
          title: `${nextEpisode.episodeNo}화 · ${nextEpisode.title}`,
          meta: formatDuration(nextEpisode.durationSec),
          description: nextEpisode.description,
          image: imageUrl(nextEpisode.posterPath ?? nextEpisode.thumbnailPath),
          trailer: null,
          detailHref: null,
          cta: "다음 화 재생",
        }
      : await getRecommendations(content, user?.id ?? null, 1).then(
          ([r]) =>
            r && {
              href: r.href,
              eyebrow: "다음에 볼 만한 콘텐츠",
              title: r.title,
              meta: r.meta,
              description: r.description,
              image: imageUrl(r.posterPath ?? r.thumbnailPath),
              trailer: imageUrl(r.trailerPath),
              detailHref: r.detailHref,
              cta: "재생",
            },
        );

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
        creditsStartSec={trailerOnly ? null : content.creditsStartSec}
        episodes={
          !trailerOnly && episodes.length > 1
            ? episodes.map((e) => ({
                href: `/watch/${e.slug}`,
                title: e.title,
                episodeNo: e.episodeNo ?? 0,
                durationSec: e.durationSec,
                image:
                  (e.thumbnailPath ?? e.posterPath)
                    ? storagePublicUrl((e.thumbnailPath ?? e.posterPath)!)
                    : null,
                current: e.slug === content.slug,
              }))
            : []
        }
        endCard={endCard ?? null}
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
