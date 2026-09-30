import { notFound } from "next/navigation";
import { SeriesDetail } from "@/components/content/series-detail";
import { TitleDetail } from "@/components/content/title-detail";
import { TitleModal } from "@/components/content/title-modal";
import { getUser } from "@/lib/auth";
import { getSeries, getTitle } from "@/lib/content";

export default async function TitleModalPage({
  params,
}: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const user = await getUser();
  const userId = user?.id ?? null;
  const data = await getTitle(slug, userId);
  const seriesData = data ? null : await getSeries(slug, userId);
  if (!data && !seriesData) notFound();
  return (
    <TitleModal labelledBy="title-modal-heading">
      {data ? (
        <TitleDetail
          data={data}
          loggedIn={Boolean(user)}
          titleId="title-modal-heading"
        />
      ) : (
        <SeriesDetail
          data={seriesData!}
          loggedIn={Boolean(user)}
          titleId="title-modal-heading"
        />
      )}
    </TitleModal>
  );
}
