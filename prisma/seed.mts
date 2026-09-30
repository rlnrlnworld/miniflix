import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("missing env: DIRECT_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

const series = [
  {
    slug: "caminandes",
    title: "Caminandes",
    description:
      "파타고니아의 라마 코로가 매번 먹을 것을 찾다 곤경에 빠지는 이야기. Blender Foundation의 오픈 무비 연작.",
    posterPath: "caminandes/poster-v2.webp",
    thumbnailPath: "caminandes/thumb-v2.webp",
    trailerPath: "caminandes-trailer/master.m3u8",
  },
];

const contents = [
  {
    slug: "bbb",
    title: "Big Buck Bunny",
    description:
      "거대한 토끼 빅 벅이 숲속 작은 동물들에게 괴롭힘을 당하다 통쾌하게 복수하는 이야기. Blender Foundation의 오픈 무비.",
    durationSec: 634,
    masterPath: "bbb/master.m3u8",
    posterPath: "bbb/poster.webp",
    thumbnailPath: "bbb/thumb.webp",
    trailerPath: "bbb-trailer/master.m3u8",
    thumbsVttPath: "bbb/thumbs/thumbs.vtt",
    renditions: [1080, 720, 480],
    subtitles: [
      {
        lang: "en",
        label: "English",
        vttPath: "bbb/subs/en.vtt",
        isDefault: false,
      },
      {
        lang: "ko",
        label: "한국어",
        vttPath: "bbb/subs/ko.vtt",
        isDefault: false,
      },
    ],
  },
  {
    slug: "spring",
    title: "Spring",
    description:
      "양치기 소녀 스프링과 개가 계절을 바꾸는 고대의 정령들과 마주하는 이야기. Blender Animation Studio의 오픈 무비.",
    durationSec: 464,
    masterPath: "spring/master.m3u8",
    posterPath: "spring/poster.webp",
    thumbnailPath: "spring/thumb.webp",
    trailerPath: "spring-trailer/master.m3u8",
    thumbsVttPath: "spring/thumbs/thumbs.vtt",
    renditions: [1080, 720, 480],
    subtitles: [
      {
        lang: "en",
        label: "English",
        vttPath: "spring/subs/en.vtt",
        isDefault: false,
      },
      {
        lang: "ko",
        label: "한국어",
        vttPath: "spring/subs/ko.vtt",
        isDefault: false,
      },
      {
        lang: "ja",
        label: "日本語",
        vttPath: "spring/subs/ja.vtt",
        isDefault: false,
      },
    ],
  },
  {
    slug: "caminandes-2",
    title: "Gran Dillama",
    description:
      "울타리 너머의 풀을 노리던 코로가 아르마딜로에게서 얻은 영감으로 전기 울타리에 도전한다.",
    durationSec: 146,
    masterPath: "caminandes-2/master.m3u8",
    posterPath: "caminandes-2/images/poster.webp",
    thumbnailPath: "caminandes-2/images/thumb.webp",
    trailerPath: "caminandes-trailer/master.m3u8",
    thumbsVttPath: "caminandes-2/thumbs/thumbs.vtt",
    renditions: [720, 480],
    creditsStartSec: 118,
    seriesSlug: "caminandes",
    episodeNo: 2,
    subtitles: [],
  },
  {
    slug: "caminandes-3",
    title: "Llamigos",
    description:
      "겨울 파타고니아, 먹을 것이 귀해진 코로가 마지막 남은 붉은 열매를 두고 아기 펭귄 오티와 맞선다.",
    durationSec: 150,
    masterPath: "caminandes-3/master.m3u8",
    posterPath: "caminandes-3/images/poster.webp",
    thumbnailPath: "caminandes-3/images/thumb.webp",
    trailerPath: "caminandes-trailer/master.m3u8",
    thumbsVttPath: "caminandes-3/thumbs/thumbs.vtt",
    renditions: [720, 480],
    creditsStartSec: 138,
    seriesSlug: "caminandes",
    episodeNo: 3,
    subtitles: [],
  },
];

async function main() {
  const seriesId = new Map<string, string>();
  for (const s of series) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
    seriesId.set(row.slug, row.id);
    console.log(`series ${row.slug} (${row.id})`);
  }
  for (const { subtitles, seriesSlug, episodeNo, ...c } of contents as Array<
    (typeof contents)[number] & { seriesSlug?: string; episodeNo?: number }
  >) {
    const data = {
      ...c,
      seriesId: seriesSlug ? (seriesId.get(seriesSlug) ?? null) : null,
      episodeNo: episodeNo ?? null,
    };
    if (seriesSlug && !data.seriesId)
      throw new Error(`no series: ${seriesSlug}`);
    const row = await prisma.content.upsert({
      where: { slug: c.slug },
      update: data,
      create: data,
    });
    console.log(`content ${row.slug} (${row.id})`);
    for (const sub of subtitles) {
      await prisma.subtitle.upsert({
        where: { contentId_lang: { contentId: row.id, lang: sub.lang } },
        update: sub,
        create: { ...sub, contentId: row.id },
      });
      console.log(`  subtitle ${sub.lang}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
