import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COMPLETE_RATIO = 0.9;

const body = z.object({
  positionSec: z
    .number()
    .min(0)
    .max(24 * 3600),
  durationSec: z
    .number()
    .positive()
    .max(24 * 3600),
});

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/watch/[contentId]">,
) {
  const { contentId } = await ctx.params;
  if (!z.uuid().safeParse(contentId).success)
    return new NextResponse(null, { status: 400 });

  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const positionSec = Math.floor(parsed.data.positionSec);
  const completed = positionSec >= parsed.data.durationSec * COMPLETE_RATIO;
  const now = new Date();

  try {
    await prisma.watchHistory.upsert({
      where: { userId_contentId: { userId: user.id, contentId } },
      create: {
        userId: user.id,
        contentId,
        positionSec,
        completed,
        lastWatchedAt: now,
      },
      update: { positionSec, completed, lastWatchedAt: now },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
