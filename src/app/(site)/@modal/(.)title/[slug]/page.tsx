import { notFound } from "next/navigation";
import { TitleDetail } from "@/components/content/title-detail";
import { TitleModal } from "@/components/content/title-modal";
import { getUser } from "@/lib/auth";
import { getTitle } from "@/lib/content";

export default async function TitleModalPage({
  params,
}: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const user = await getUser();
  const data = await getTitle(slug, user?.id ?? null);
  if (!data) notFound();
  return (
    <TitleModal labelledBy="title-modal-heading">
      <TitleDetail
        data={data}
        loggedIn={Boolean(user)}
        titleId="title-modal-heading"
      />
    </TitleModal>
  );
}
