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
  const [history, nextEpisode] = await Promise.all([
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
          select: { slug: true, title: true, episodeNo: true },
        })
      : null,
  ]);
  return {
    content,
    resumeAt: resumeFrom(history),
    completed: history?.completed ?? false,
    nextEpisode,
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
