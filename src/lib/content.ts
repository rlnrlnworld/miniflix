import { prisma } from "@/lib/prisma";

export const RESUME_MIN_SEC = 30;

export async function getTitle(slug: string, userId: string | null) {
  const content = await prisma.content.findUnique({
    where: { slug },
    include: {
      subtitles: {
        select: { lang: true, label: true },
        orderBy: { lang: "asc" },
      },
    },
  });
  if (!content) return null;
  const history = userId
    ? await prisma.watchHistory.findUnique({
        where: { userId_contentId: { userId, contentId: content.id } },
        select: { positionSec: true, completed: true },
      })
    : null;
  const resumeAt =
    history && !history.completed && history.positionSec >= RESUME_MIN_SEC
      ? history.positionSec
      : null;
  return { content, resumeAt, completed: history?.completed ?? false };
}

export type TitleData = NonNullable<Awaited<ReturnType<typeof getTitle>>>;
