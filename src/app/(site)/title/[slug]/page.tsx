import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesDetail } from "@/components/content/series-detail";
import { TitleDetail } from "@/components/content/title-detail";
import { getUser } from "@/lib/auth";
import { getSeries, getTitle } from "@/lib/content";
import { SITE_DESCRIPTION } from "@/lib/site";
import { storagePublicUrl } from "@/lib/storage";

export async function generateMetadata({
  params,
}: PageProps<"/title/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTitle(slug, null);
  const item = data ? data.content : (await getSeries(slug, null))?.series;
  if (!item) return { title: "콘텐츠를 찾을 수 없습니다" };
  const description = item.description ?? SITE_DESCRIPTION;
  const image = item.posterPath ? storagePublicUrl(item.posterPath) : undefined;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/title/${slug}` },
    openGraph: {
      type: "video.other",
      url: `/title/${slug}`,
      title: item.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TitlePage({
  params,
}: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const user = await getUser();
  const userId = user?.id ?? null;
  const data = await getTitle(slug, userId);
  const seriesData = data ? null : await getSeries(slug, userId);
  if (!data && !seriesData) notFound();
  return (
    <main className="bg-paper text-ink min-h-dvh px-0 pt-16 pb-16 sm:px-8 sm:pt-24">
      <div className="mx-auto w-full max-w-3xl overflow-hidden sm:rounded-2xl">
        {data ? (
          <TitleDetail
            data={data}
            loggedIn={Boolean(user)}
            titleId="title-heading"
          />
        ) : (
          <SeriesDetail
            data={seriesData!}
            loggedIn={Boolean(user)}
            titleId="title-heading"
          />
        )}
      </div>
    </main>
  );
}
