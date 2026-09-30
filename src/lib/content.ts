import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const RESUME_MIN_SEC = 30;

function resumeFrom(
  history: { positionSec: number; completed: boolean } | null | undefined,
) {
  return history && !history.completed && history.positionSec >= RESUME_MIN_SEC
    ? history.positionSec
    : null;
}

/** 단일 콘텐츠(또는 에피소드) 상세. 시리즈 소속이면 다음 화 정보를 함께 준다. */
export async function getTitle(slug: string, userId: string | null) {
  const content = await prisma.content.findUnique({
    where: { slug },
    include: {
      subtitles: {
        select: { lang: true, label: true, vttPath: true, isDefault: true },
        orderBy: { lang: "asc" },
      },
      series: { select: { slug: true, title: true } },
    },
  });
  if (!content) return null;
  const [history, nextEpisode, episodes] = await Promise.all([
    userId
      ? prisma.watchHistory.findUnique({
          where: { userId_contentId: { userId, contentId: content.id } },
          select: { positionSec: true, completed: true },
        })
      : null,
    content.seriesId && content.episodeNo !== null
      ? prisma.content.findFirst({
          where: {
            seriesId: content.seriesId,
            episodeNo: { gt: content.episodeNo },
          },
          orderBy: { episodeNo: "asc" },
          select: {
            slug: true,
            title: true,
            episodeNo: true,
            durationSec: true,
            description: true,
            posterPath: true,
            thumbnailPath: true,
          },
        })
      : null,
    content.seriesId
      ? prisma.content.findMany({
          where: { seriesId: content.seriesId },
          orderBy: { episodeNo: "asc" },
          select: {
            slug: true,
            title: true,
            episodeNo: true,
            durationSec: true,
            thumbnailPath: true,
            posterPath: true,
          },
        })
      : [],
  ]);
  return {
    content,
    resumeAt: resumeFrom(history),
    completed: history?.completed ?? false,
    nextEpisode,
    /** 같은 시리즈의 전체 에피소드(회차순). 단편이면 빈 배열. */
    episodes,
  };
}

export type TitleData = NonNullable<Awaited<ReturnType<typeof getTitle>>>;

/** 시리즈 상세. 에피소드별 진행률과 "이어볼 화"를 계산한다. */
export async function getSeries(slug: string, userId: string | null) {
  const series = await prisma.series.findUnique({
    where: { slug },
    include: {
      episodes: {
        orderBy: { episodeNo: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          durationSec: true,
          thumbnailPath: true,
          episodeNo: true,
          renditions: true,
        },
      },
    },
  });
  if (!series) return null;
  const histories = userId
    ? await prisma.watchHistory.findMany({
        where: { userId, contentId: { in: series.episodes.map((e) => e.id) } },
        select: {
          contentId: true,
          positionSec: true,
          completed: true,
          lastWatchedAt: true,
        },
      })
    : [];
  const byId = new Map(histories.map((h) => [h.contentId, h]));
  const episodes = series.episodes.map((e) => {
    const h = byId.get(e.id);
    return {
      ...e,
      progress: h ? (h.completed ? 1 : h.positionSec / e.durationSec) : 0,
      completed: h?.completed ?? false,
    };
  });
  // 이어볼 화: 가장 최근 본 미완료 화 → 없으면 첫 미완료 화 → 없으면 1화(다시 보기)
  const recent = histories
    .filter((h) => !h.completed && h.positionSec >= RESUME_MIN_SEC)
    .sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime())[0];
  const recentEp = recent && episodes.find((e) => e.id === recent.contentId);
  const firstUnwatched = episodes.find((e) => !e.completed);
  const resume = recentEp
    ? { episode: recentEp, positionSec: recent.positionSec }
    : firstUnwatched
      ? { episode: firstUnwatched, positionSec: 0 }
      : episodes[0]
        ? { episode: episodes[0], positionSec: 0, rewatch: true }
        : null;
  return { series, episodes, resume };
}

export type SeriesData = NonNullable<Awaited<ReturnType<typeof getSeries>>>;

export type Recommendation = {
  /** 바로 재생할 경로. 시리즈면 1화. */
  href: string;
  /** 상세 페이지. */
  detailHref: string;
  title: string;
  meta: string;
  description: string | null;
  trailerPath: string | null;
  /** 큰 카드용 이미지(포스터 우선). */
  posterPath: string | null;
  thumbnailPath: string | null;
};

/**
 * 재생 종료 오버레이용 추천. 현재 콘텐츠(와 그 시리즈)를 뺀 단편 + 시리즈를
 * 최신순으로 limit 개. 사용자가 완주한 단편은 뒤로 미룬다.
 */
export async function getRecommendations(
  current: { id: string; seriesId: string | null },
  userId: string | null,
  limit = 3,
): Promise<Recommendation[]> {
  const [contents, seriesList] = await Promise.all([
    prisma.content.findMany({
      where: { seriesId: null, id: { not: current.id } },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        durationSec: true,
        thumbnailPath: true,
        posterPath: true,
        trailerPath: true,
        createdAt: true,
      },
    }),
    prisma.series.findMany({
      where: current.seriesId ? { id: { not: current.seriesId } } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        slug: true,
        title: true,
        description: true,
        thumbnailPath: true,
        posterPath: true,
        trailerPath: true,
        createdAt: true,
        _count: { select: { episodes: true } },
        episodes: {
          orderBy: { episodeNo: "asc" },
          take: 1,
          select: { slug: true },
        },
      },
    }),
  ]);
  const completed = new Set(
    userId && contents.length
      ? (
          await prisma.watchHistory.findMany({
            where: {
              userId,
              completed: true,
              contentId: { in: contents.map((c) => c.id) },
            },
            select: { contentId: true },
          })
        ).map((h) => h.contentId)
      : [],
  );
  const items = [
    ...contents.map((c) => ({
      href: `/watch/${c.slug}`,
      detailHref: `/title/${c.slug}`,
      title: c.title,
      meta: formatDuration(c.durationSec),
      description: c.description,
      trailerPath: c.trailerPath,
      posterPath: c.posterPath,
      thumbnailPath: c.thumbnailPath ?? c.posterPath,
      createdAt: c.createdAt,
      done: completed.has(c.id),
    })),
    ...seriesList.map((s) => ({
      href: s.episodes[0] ? `/watch/${s.episodes[0].slug}` : `/title/${s.slug}`,
      detailHref: `/title/${s.slug}`,
      title: s.title,
      meta: `에피소드 ${s._count.episodes}개`,
      description: s.description,
      trailerPath: s.trailerPath,
      posterPath: s.posterPath,
      thumbnailPath: s.thumbnailPath ?? s.posterPath,
      createdAt: s.createdAt,
      done: false,
    })),
  ]
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, limit);
  return items.map(
    ({
      href,
      detailHref,
      title,
      meta,
      description,
      trailerPath,
      posterPath,
      thumbnailPath,
    }) => ({
      href,
      detailHref,
      title,
      meta,
      description,
      trailerPath,
      posterPath,
      thumbnailPath,
    }),
  );
}
