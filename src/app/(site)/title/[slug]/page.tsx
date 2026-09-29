import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitleDetail } from "@/components/content/title-detail";
import { getUser } from "@/lib/auth";
import { getTitle } from "@/lib/content";
import { SITE_DESCRIPTION } from "@/lib/site";
import { storagePublicUrl } from "@/lib/storage";

export async function generateMetadata({
  params,
}: PageProps<"/title/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTitle(slug, null);
  if (!data) return { title: "콘텐츠를 찾을 수 없습니다" };
  const { content } = data;
  const description = content.description ?? SITE_DESCRIPTION;
  const image = content.posterPath
    ? storagePublicUrl(content.posterPath)
    : undefined;
  return {
    title: content.title,
    description,
    alternates: { canonical: `/title/${slug}` },
    openGraph: {
      type: "video.other",
      url: `/title/${slug}`,
      title: content.title,
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
  const data = await getTitle(slug, user?.id ?? null);
  if (!data) notFound();
  return (
    <main className="bg-paper text-ink min-h-dvh px-0 pt-16 pb-16 sm:px-8 sm:pt-24">
      <div className="mx-auto w-full max-w-3xl overflow-hidden sm:rounded-2xl">
        <TitleDetail
          data={data}
          loggedIn={Boolean(user)}
          titleId="title-heading"
        />
      </div>
    </main>
  );
}
