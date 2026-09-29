import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("missing env: DIRECT_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

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
];

async function main() {
  for (const { subtitles, ...c } of contents) {
    const row = await prisma.content.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
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
