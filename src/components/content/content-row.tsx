import { ContentCard, type ContentCardData } from "./content-card";

export function ContentRow({
  title,
  items,
}: {
  title: string;
  items: ContentCardData[];
}) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby={`row-${title}`}
      className="mx-auto w-full max-w-7xl px-4 sm:px-8"
    >
      <h2 id={`row-${title}`} className="text-ink mb-3 text-lg font-semibold">
        {title}
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {items.map((c) => (
          <li key={c.slug} className="shrink-0 sm:shrink">
            <ContentCard content={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}
