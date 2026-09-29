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
    posterPath: null,
    thumbnailPath: null,
  },
];

async function main() {
  for (const c of contents) {
    const row = await prisma.content.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
    console.log(`content ${row.slug} (${row.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
