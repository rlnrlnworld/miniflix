import type { Metadata } from "next";
import { ContentCard, episodeMeta } from "@/components/content/content-card";
import { prisma } from "@/lib/prisma";

const MAX_QUERY = 100;

function normalize(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, MAX_QUERY);
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/search">): Promise<Metadata> {
  const q = normalize((await searchParams).q);
  return {
    title: q ? `‘${q}’ 검색 결과` : "검색",
    robots: { index: false, follow: false },
  };
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const q = normalize((await searchParams).q);
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
  const results = tokens.length
    ? await prisma.content.findMany({
        where: {
          AND: tokens.map((t) => ({
            OR: [
              { title: { contains: t, mode: "insensitive" as const } },
              { description: { contains: t, mode: "insensitive" as const } },
              {
                series: {
                  title: { contains: t, mode: "insensitive" as const },
                },
              },
            ],
          })),
        },
        orderBy: { createdAt: "desc" },
        take: 48,
        include: { series: { select: { title: true } } },
      })
    : [];

  return (
    <>
      <main className="bg-paper text-ink min-h-dvh px-4 pt-24 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          {q ? (
            <>
              <h1 className="text-ink text-xl font-semibold">
                ‘{q}’ 검색 결과
                <span className="text-muted ml-2 text-base font-normal tabular-nums">
                  {results.length}
                </span>
              </h1>
              {results.length > 0 ? (
                <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {results.map((c) => (
                    <li key={c.slug}>
                      <ContentCard content={{ ...c, meta: episodeMeta(c) }} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-2 mt-6 text-base break-keep">
                  일치하는 콘텐츠가 없습니다. 제목이나 설명에 들어가는 다른
                  단어로 찾아보세요.
                </p>
              )}
            </>
          ) : (
            <h1 className="text-ink-2 text-xl font-semibold">
              검색어를 입력하세요
            </h1>
          )}
        </div>
      </main>
    </>
  );
}
